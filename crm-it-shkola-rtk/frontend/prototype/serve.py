"""Статический сервер прототипа без кэширования.

support.js подгружает экраны (dc-import) обычным fetch, а python -m http.server
не запрещает кэш — браузер отдаёт старые версии экранов даже после перезагрузки.
Здесь каждый ответ помечен Cache-Control: no-store.

Запуск: python3 serve.py [порт]   (по умолчанию 8123)
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    handler = functools.partial(NoCacheHandler, directory=os.path.dirname(os.path.abspath(__file__)))
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    except OSError:
        sys.exit(
            f"Порт {port} уже занят — прототип, скорее всего, уже запущен: http://localhost:{port}/CRM.dc.html\n"
            f"Чтобы поднять второй экземпляр, укажите другой порт: python3 serve.py {port + 1}"
        )
    print(f"Прототип: http://localhost:{port}/CRM.dc.html  (админка: /Admin.dc.html)")
    server.serve_forever()
