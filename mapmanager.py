import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog
import json
import re
import os
import sys

def load_maplist(path):
    if not os.path.exists(path):
        return []
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    match = re.search(r'window\.OFFICIAL_MAP_LIST\s*=\s*(\[[\s\S]*\])\s*;?', content)
    if not match:
        raise ValueError("无法从文件中解析出 OFFICIAL_MAP_LIST，请检查格式。")
    raw_json = match.group(1)
    raw_json = re.sub(r',\s*([\]}])', r'\1', raw_json)
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON 解析错误：{e}。请确保使用双引号且无尾随逗号。")
    return data

def save_maplist(path, map_list):
    json_str = json.dumps(map_list, ensure_ascii=False, indent=4)
    content = f"window.OFFICIAL_MAP_LIST = {json_str};\n"
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

class MapListManager:
    def __init__(self, root, file_path):
        self.root = root
        self.file_path = file_path
        self.root.title("官方地图管理器")
        self.root.geometry("500x400")

        try:
            self.maps = load_maplist(file_path)
        except Exception as e:
            messagebox.showerror("读取错误", str(e))
            self.maps = []

        self.listbox = tk.Listbox(root, selectmode=tk.SINGLE)
        self.listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=10)
        self.refresh_list()

        btn_frame = tk.Frame(root)
        btn_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=10, pady=10)

        tk.Button(btn_frame, text="添加地图", command=self.add_map, width=18).pack(pady=5)
        tk.Button(btn_frame, text="删除选中", command=self.delete_map, width=18).pack(pady=5)
        tk.Button(btn_frame, text="保存更改", command=self.save, width=18).pack(pady=5)
        tk.Button(btn_frame, text="清空所有地图", command=self.clear_all, width=18, fg="red").pack(pady=15)
        tk.Button(btn_frame, text="退出", command=self.on_exit, width=18).pack(pady=20)

        self.modified = False

    def refresh_list(self):
        self.listbox.delete(0, tk.END)
        for m in self.maps:
            self.listbox.insert(tk.END, m.get('name', '未命名'))

    def add_map(self):
        file = filedialog.askopenfilename(
            title="选择地图 JSON 文件",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if not file:
            return
        try:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            messagebox.showerror("读取失败", f"无法解析 JSON 文件：{e}")
            return

        default_name = data.get('title', os.path.splitext(os.path.basename(file))[0])
        name = simpledialog.askstring("地图名称", "请输入地图显示名称：", initialvalue=default_name)
        if not name:
            return

        self.maps.append({"name": name, "data": data})
        self.modified = True
        self.refresh_list()
        messagebox.showinfo("成功", f"已添加地图“{name}”")

    def delete_map(self):
        selection = self.listbox.curselection()
        if not selection:
            messagebox.showwarning("未选择", "请先在左侧列表中选择一个地图。")
            return
        index = selection[0]
        name = self.maps[index].get('name', '未命名')
        if messagebox.askyesno("确认删除", f"确定要删除地图“{name}”吗？"):
            del self.maps[index]
            self.modified = True
            self.refresh_list()

    def clear_all(self):
        if not self.maps:
            messagebox.showinfo("无需清空", "列表已为空。")
            return
        if messagebox.askyesno("危险操作", "确定要删除所有官方地图吗？此操作不可撤销！"):
            self.maps.clear()
            self.modified = True
            self.refresh_list()
            messagebox.showinfo("已清空", "地图列表已清空，请记得保存更改。")

    def save(self):
        try:
            save_maplist(self.file_path, self.maps)
            self.modified = False
            messagebox.showinfo("保存成功", "maplist.js 已更新。")
        except Exception as e:
            messagebox.showerror("保存失败", str(e))

    def on_exit(self):
        if self.modified:
            if messagebox.askyesno("未保存", "你有未保存的更改，是否保存后退出？"):
                self.save()
        self.root.destroy()

if __name__ == "__main__":
    # 优先使用命令行参数，否则默认脚本所在目录下的 JS/maplist.js
    if len(sys.argv) > 1:
        target_path = sys.argv[1]
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        target_path = os.path.join(script_dir, "JS", "maplist.js")

    root = tk.Tk()
    app = MapListManager(root, target_path)
    root.protocol("WM_DELETE_WINDOW", app.on_exit)
    root.mainloop()