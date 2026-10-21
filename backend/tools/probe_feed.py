"""Probe /video_feed: berapa banyak frame JPEG yang benar-benar dikirim server."""
import http.client
import time


def hitung_frame(detik):
    conn = http.client.HTTPConnection("127.0.0.1", 8000, timeout=detik + 5)
    conn.request("GET", "/video_feed")
    respons = conn.getresponse()
    ctype = respons.getheader("Content-Type")
    print("status", respons.status, "|", ctype)
    batas = time.time() + detik
    buffer = b""
    jumlah = 0
    byte = 0
    waktu_frame = []
    terakhir = time.time()
    while time.time() < batas:
        try:
            potongan = respons.read(65536)
        except Exception as exc:
            print("read error:", type(exc).__name__, exc)
            break
        if not potongan:
            print("stream berakhir (tidak ada data)")
            break
        byte += len(potongan)
        sekarang = time.time()
        buffer += potongan
        while True:
            mulai = buffer.find(b"\xff\xd8")
            akhir = buffer.find(b"\xff\xd9")
            if mulai == -1 or akhir == -1 or akhir < mulai:
                break
            buffer = buffer[akhir + 2:]
            jumlah += 1
            waktu_frame.append(sekarang - terakhir)
            terakhir = sekarang
    print(f"frame JPEG = {jumlah}  byte = {byte}")
    if waktu_frame:
        print(f"jeda antar frame (dtk): min {min(waktu_frame):.3f} "
              f"maks {max(waktu_frame):.3f} rata2 {sum(waktu_frame)/len(waktu_frame):.3f}")
    conn.close()


if __name__ == "__main__":
    hitung_frame(6)
