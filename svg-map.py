import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
import xml.etree.ElementTree as ET
import re
import json
import os

# ---------- 解析部分 ----------

def parse_pixel_svg(file_path):
    """
    解析像素地图 SVG/XML 文件，返回：
        - tiles: 二维列表，每个元素为 {'terrain': 'land'/'sea', 'owner': 势力id 或 None, 'city': False, 'cityName': '', 'unit': None}
        - factions: [{'id':..., 'name':..., 'color':..., 'camp':''}, ...]
        - width, height: 整数
    """
    tree = ET.parse(file_path)
    root = tree.getroot()

    # 提取命名空间（如果有）
    ns = {}
    if '}' in root.tag:
        ns['svg'] = root.tag.split('}')[0][1:]
        ns_prefix = '{' + ns['svg'] + '}'
    else:
        ns_prefix = ''

    # 1. 解析 style 获取势力颜色
    faction_colors = {}
    style_elem = root.find(f'{ns_prefix}style')
    if style_elem is not None and style_elem.text:
        # 匹配类似 #FR { fill: #007bff; } 的规则
        rules = re.findall(r'#(\w+)\s*\{[^}]*fill:\s*(#[0-9a-fA-F]+)', style_elem.text)
        for fid, color in rules:
            faction_colors[fid] = color

    # 2. 收集所有 rect 及其所属势力
    rects = []  # (col, row, owner_id)
    all_g = root.findall(f'.//{ns_prefix}g')
    faction_info = {}  # id -> {'name':..., 'color':...}

    for g in all_g:
        gid = g.get('id', '').strip()
        title = g.get('title', gid).strip()
        if not gid:
            continue
        # 记录势力信息
        if gid not in faction_info:
            faction_info[gid] = {
                'name': title,
                'color': faction_colors.get(gid, '#888888')  # 默认灰色
            }

        # 获取该 g 内的所有 rect
        for rect in g.findall(f'{ns_prefix}rect'):
            x = float(rect.get('x', '0'))
            y = float(rect.get('y', '0'))
            w = float(rect.get('width', '6.69'))
            h = float(rect.get('height', '6.69'))
            rects.append((x, y, gid))

    if not rects:
        raise ValueError("未找到任何像素矩形，可能不是有效的像素地图文件")

    # 3. 计算网格范围
    cell_size = 6.69  # 根据给定文件特点
    xs = [r[0] for r in rects]
    ys = [r[1] for r in rects]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    # 计算列数和行数
    cols = int(round((max_x - min_x) / cell_size)) + 1
    rows = int(round((max_y - min_y) / cell_size)) + 1

    # 4. 初始化网格 (全部海洋)
    tiles = []
    for r in range(rows):
        row = []
        for c in range(cols):
            row.append({
                'terrain': 'sea',
                'owner': None,
                'city': False,
                'cityName': '',
                'unit': None
            })
        tiles.append(row)

    # 5. 填充陆地及势力
    for x, y, owner_id in rects:
        col = int(round((x - min_x) / cell_size))
        row = int(round((y - min_y) / cell_size))
        if 0 <= row < rows and 0 <= col < cols:
            tile = tiles[row][col]
            tile['terrain'] = 'land'
            tile['owner'] = owner_id

    # 6. 构建势力列表
    factions = []
    for fid in sorted(faction_info.keys()):
        info = faction_info[fid]
        factions.append({
            'id': fid,
            'name': info['name'],
            'color': info['color'],
            'camp': ''
        })

    return tiles, factions, cols, rows


# ---------- GUI 部分 ----------

class ConverterApp:
    def __init__(self, root):
        self.root = root
        root.title("像素地图 → 游戏 JSON 转换器")
        root.geometry("600x400")

        # 输入文件
        tk.Label(root, text="输入像素地图文件 (SVG/JSON):").grid(row=0, column=0, sticky='w', padx=10, pady=5)
        self.input_path = tk.StringVar()
        tk.Entry(root, textvariable=self.input_path, width=60).grid(row=1, column=0, padx=10, pady=2, sticky='we')
        tk.Button(root, text="浏览...", command=self.browse_input).grid(row=1, column=1, padx=5, pady=2)

        # 输出文件
        tk.Label(root, text="输出游戏地图 JSON 文件:").grid(row=2, column=0, sticky='w', padx=10, pady=5)
        self.output_path = tk.StringVar()
        tk.Entry(root, textvariable=self.output_path, width=60).grid(row=3, column=0, padx=10, pady=2, sticky='we')
        tk.Button(root, text="浏览...", command=self.browse_output).grid(row=3, column=1, padx=5, pady=2)

        # 转换按钮
        tk.Button(root, text="开始转换", command=self.convert, bg='#4CAF50', fg='white', font=('Arial', 12)).grid(row=4, column=0, columnspan=2, pady=15)

        # 状态日志
        self.log = scrolledtext.ScrolledText(root, width=70, height=10, state='normal')
        self.log.grid(row=5, column=0, columnspan=2, padx=10, pady=5, sticky='nsew')

        root.grid_rowconfigure(5, weight=1)
        root.grid_columnconfigure(0, weight=1)

    def browse_input(self):
        path = filedialog.askopenfilename(
            title="选择像素地图文件",
            filetypes=[("SVG/JSON files", "*.svg *.json"), ("All files", "*.*")]
        )
        if path:
            self.input_path.set(path)
            # 自动生成输出路径
            base = os.path.splitext(path)[0]
            self.output_path.set(base + "_game.json")

    def browse_output(self):
        path = filedialog.asksaveasfilename(
            title="保存游戏地图 JSON",
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if path:
            self.output_path.set(path)

    def log_message(self, msg):
        self.log.insert(tk.END, msg + '\n')
        self.log.see(tk.END)
        self.root.update_idletasks()

    def convert(self):
        in_path = self.input_path.get().strip()
        out_path = self.output_path.get().strip()

        if not in_path:
            messagebox.showerror("错误", "请选择输入文件")
            return
        if not out_path:
            messagebox.showerror("错误", "请指定输出文件")
            return
        if not os.path.exists(in_path):
            messagebox.showerror("错误", "输入文件不存在")
            return

        self.log.delete('1.0', tk.END)
        self.log_message("开始解析像素地图...")
        try:
            tiles, factions, width, height = parse_pixel_svg(in_path)
        except Exception as e:
            messagebox.showerror("解析失败", str(e))
            self.log_message(f"错误: {e}")
            return

        self.log_message(f"解析完成，地图尺寸：{width} x {height}，势力数量：{len(factions)}")

        # 构建最终 JSON
        map_data = {
            "title": os.path.splitext(os.path.basename(in_path))[0],
            "width": width,
            "height": height,
            "tiles": tiles,
            "factions": factions,
            "events": [],
            "turnOrder": [f['id'] for f in factions]
        }

        try:
            with open(out_path, 'w', encoding='utf-8') as f:
                json.dump(map_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            messagebox.showerror("写入失败", str(e))
            self.log_message(f"写入文件失败: {e}")
            return

        self.log_message(f"成功保存到 {out_path}")
        messagebox.showinfo("完成", "转换成功！")


# ---------- 运行入口 ----------
if __name__ == '__main__':
    root = tk.Tk()
    app = ConverterApp(root)
    root.mainloop()