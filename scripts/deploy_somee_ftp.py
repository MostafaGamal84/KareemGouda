import argparse
import ftplib
import os
import pathlib
import sys
import time


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy GOUDAPREP to Somee over FTP.")
    parser.add_argument("--source", required=True)
    parser.add_argument("--host", required=True)
    parser.add_argument("--remote-root", required=True)
    parser.add_argument("--maintenance-file", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    username = os.environ.get("GOUDAPREP_FTP_USER", "")
    password = os.environ.get("GOUDAPREP_FTP_PASSWORD", "")
    if not username or not password:
        raise RuntimeError("FTP credentials were not provided through the process environment.")

    source = pathlib.Path(args.source).resolve()
    maintenance_file = pathlib.Path(args.maintenance_file).resolve()
    if not (source / "API.dll").is_file() or not (source / "wwwroot" / "index.html").is_file():
        raise RuntimeError("The production package is incomplete.")

    files = sorted(
        path for path in source.rglob("*")
        if path.is_file()
        and path.name.lower() != "app_offline.htm"
        and "uploads" not in {part.lower() for part in path.relative_to(source).parts[:2]}
    )

    ftp: ftplib.FTP | None = None

    def connect() -> ftplib.FTP:
        nonlocal ftp
        if ftp is not None:
            try:
                ftp.close()
            except Exception:
                pass
        ftp = ftplib.FTP(timeout=90)
        ftp.connect(args.host, 21)
        ftp.login(username, password)
        ftp.set_pasv(True)
        ftp.cwd(args.remote_root)
        return ftp

    def with_retry(action, label: str, attempts: int = 6):
        nonlocal ftp
        last_error: Exception | None = None
        for attempt in range(1, attempts + 1):
            try:
                client = ftp if ftp is not None else connect()
                return action(client)
            except (OSError, EOFError, ftplib.Error) as exc:
                last_error = exc
                if ftp is not None:
                    try:
                        ftp.close()
                    except Exception:
                        pass
                ftp = None
                if attempt == attempts:
                    break
                print(f"Retrying {label} ({attempt}/{attempts})...", flush=True)
                time.sleep(min(10, attempt * 2))
        raise RuntimeError(f"Failed {label} after {attempts} attempts: {last_error}")

    created_directories: set[str] = set()

    def ensure_directories(relative_path: pathlib.PurePosixPath) -> None:
        current: list[str] = []
        for part in relative_path.parent.parts:
            current.append(part)
            directory = "/".join(current)
            if directory in created_directories:
                continue

            def create(client: ftplib.FTP, name=directory):
                try:
                    client.mkd(name)
                except ftplib.error_perm as exc:
                    if not str(exc).startswith(("550", "521")):
                        raise

            with_retry(create, f"creating directory {directory}")
            created_directories.add(directory)

    connect()

    def upload(local_path: pathlib.Path, remote_path: str) -> None:
        def transfer(client: ftplib.FTP):
            with local_path.open("rb") as stream:
                client.storbinary(f"STOR {remote_path}", stream, blocksize=256 * 1024)

        with_retry(transfer, f"uploading {remote_path}")

    upload(maintenance_file, "app_offline.htm")
    upload_succeeded = False
    try:
        for index, local_path in enumerate(files, start=1):
            relative_path = pathlib.PurePosixPath(*local_path.relative_to(source).parts)
            ensure_directories(relative_path)
            upload(local_path, relative_path.as_posix())
            if index == 1 or index % 10 == 0 or index == len(files):
                print(f"Uploaded {index}/{len(files)}: {relative_path.as_posix()}", flush=True)
        upload_succeeded = True
    finally:
        if upload_succeeded:
            with_retry(lambda client: client.delete("app_offline.htm"), "removing maintenance mode")
        if ftp is not None:
            try:
                ftp.quit()
            except Exception:
                ftp.close()

    print(f"Deployment completed: {len(files)} files uploaded.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
