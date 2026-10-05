import os
import re
import time


def phoenix_system_data():
    def cpu_percent():
        try:
            def snap():
                with open("/proc/stat", "r", encoding="utf-8") as handle:
                    parts = handle.readline().split()[1:]

                nums = [int(value) for value in parts]
                idle = nums[3] + nums[4]
                total = sum(nums)

                return idle, total

            idle1, total1 = snap()
            time.sleep(0.1)
            idle2, total2 = snap()

            idle_delta = idle2 - idle1
            total_delta = total2 - total1

            if total_delta <= 0:
                return 0

            return round((1 - idle_delta / total_delta) * 100)

        except Exception:
            return 0

    def ram_percent():
        try:
            data = {}

            with open("/proc/meminfo", "r", encoding="utf-8") as handle:
                for line in handle:
                    key, value = line.split(":", 1)
                    data[key] = int(value.strip().split()[0])

            total = data.get("MemTotal", 1)
            available = data.get("MemAvailable", 0)
            used = total - available

            return round((used / total) * 100)

        except Exception:
            return 0

    def disk_percent():
        try:
            stats = os.statvfs("/")

            total = stats.f_blocks * stats.f_frsize
            free = stats.f_bavail * stats.f_frsize
            used = total - free

            return round((used / total) * 100) if total else 0

        except Exception:
            return 0

    return {
        "cpu": f"{cpu_percent()}%",
        "ram": f"{ram_percent()}%",
        "disk": f"{disk_percent()}%",
    }


def inject_system_numbers(html: str) -> str:
    data = phoenix_system_data()

    for key, value in data.items():
        html = re.sub(
            rf'<span data-system-value="{key}">.*?</span>',
            f'<span data-system-value="{key}">{value}</span>',
            html,
        )

    return html
