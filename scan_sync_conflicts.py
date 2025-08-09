

import os
import argparse

def manage_conflict_files(root_dir, perform_delete=False):
    """
    在指定目录及其子目录中查找并选择性地删除由同步冲突产生的重复文件。
    默认只查找并报告，需要 --delete 参数才会执行删除操作。
    """
    if perform_delete:
        print(f"Starting scan and DELETE in directory: {os.path.abspath(root_dir)}...")
        print("!!! DELETE MODE IS ACTIVE. CONFLICT FILES WILL BE REMOVED. !!!")
    else:
        print(f"Starting scan in directory: {os.path.abspath(root_dir)}... (Dry run mode)")
    
    found_any_duplicates = False

    # 使用 os.walk 递归遍历目录树
    # topdown=False 可以让我们先处理子目录，虽然在这里影响不大
    for dirpath, _, filenames in os.walk(root_dir):
        if not filenames:
            continue

        filenames_set = set(filenames)
        groups = {}

        for filename in filenames:
            base_file = filename
            current_lookup = filename
            
            while True:
                base, ext = os.path.splitext(current_lookup)
                parts = base.rsplit('-', 1)
                
                if len(parts) < 2 or not parts[1]:
                    break
                
                potential_parent_base = parts[0]
                potential_parent_filename = potential_parent_base + ext
                
                if potential_parent_filename in filenames_set:
                    current_lookup = potential_parent_filename
                    base_file = potential_parent_filename
                else:
                    break
            
            if base_file not in groups:
                groups[base_file] = []
            groups[base_file].append(filename)

        for base_file, file_list in groups.items():
            if len(file_list) > 1:
                found_any_duplicates = True
                print(f"\nFound duplicate set in directory: {dirpath}")
                
                # 将原始文件和冲突文件分开
                original_file = os.path.join(dirpath, base_file)
                conflicts_to_process = []
                
                print(f"  - Original: {original_file}")
                
                for f in sorted(file_list):
                    if f != base_file:
                        conflict_path = os.path.join(dirpath, f)
                        conflicts_to_process.append(conflict_path)
                        print(f"  - Conflict: {conflict_path}")

                # 如果 --delete 标志被设置，则执行删除
                if perform_delete and conflicts_to_process:
                    print("  - Deleting conflicts...")
                    for path_to_delete in conflicts_to_process:
                        try:
                            os.remove(path_to_delete)
                            print(f"    - Deleted: {path_to_delete}")
                        except OSError as e:
                            print(f"    - Error deleting {path_to_delete}: {e}")

    if not found_any_duplicates:
        print("\nScan complete. No duplicate files found matching the conflict pattern.")
    else:
        if perform_delete:
            print("\nScan and deletion complete.")
        else:
            print("\nScan complete. No files were changed. (Use --delete to remove conflicts)")

if __name__ == "__main__":
    # 设置命令行参数解析器
    parser = argparse.ArgumentParser(
        description="Find and optionally delete OneDrive/sync conflict files.",
        epilog="By default, this script runs in 'dry run' mode and will not delete any files. Use the --delete flag to enable deletion."
    )
    parser.add_argument(
        '--delete',
        action='store_true',
        help="Enable deletion mode. Without this flag, the script only reports what it would do."
    )
    
    args = parser.parse_args()

    # 从当前目录开始搜索
    manage_conflict_files('.', perform_delete=args.delete)

