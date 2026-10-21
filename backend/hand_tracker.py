"""hand_tracker.py — beri id stabil untuk tiap tangan dari frame ke frame.

MediaPipe tidak menjamin urutan tangan sama dari frame ke frame, jadi pipeline
tidak bisa memakai satu smoother bersama: gestur tangan A bisa nyangkut ke
wayang milik tangan B. Tracker ini mencocokkan pergelangan tangan (wrist)
frame sekarang dengan track terakhir dan memberi id yang sama selama posisi
masih masuk akal untuk tangan yang sama.
"""
from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class _Track:
    id: int
    x: float
    y: float
    hilang: int = 0  # berapa frame terakhir track ini tidak ditemukan


class HandTracker:
    def __init__(self, max_tangan: int, jarak_maks: float,
                 hilang_maks: int) -> None:
        self.max_tangan = max(1, int(max_tangan))
        self.jarak_maks = float(jarak_maks)
        self.hilang_maks = max(1, int(hilang_maks))
        self._tracks: list[_Track] = []
        self._id_berikutnya = 0

    def reset(self) -> None:
        self._tracks.clear()
        self._id_berikutnya = 0

    def update(self, wrists) -> list[int]:
        """wrist: [(x, y), ...] urutannya sama dengan daftar landmark.

        Kembalikan daftar id dengan panjang dan urutan yang sama.
        """
        if not wrists:
            self._mark_hilang(set())
            self._buang_kedaluwarsa()
            return []

        jarak = []
        for i, (x, y) in enumerate(wrists):
            for j, track in enumerate(self._tracks):
                jarak.append((math.hypot(x - track.x, y - track.y), i, j))
        jarak.sort()

        id_hasil: list[int | None] = [None] * len(wrists)
        terpasang: set[int] = set()
        for jauh, i, j in jarak:
            if jauh > self.jarak_maks:
                break
            if id_hasil[i] is not None or j in terpasang:
                continue
            track = self._tracks[j]
            id_hasil[i] = track.id
            terpasang.add(j)
            track.x, track.y = wrists[i]
            track.hilang = 0

        self._mark_hilang(terpasang)

        for i, item in enumerate(id_hasil):
            if item is not None:
                continue
            self._ruang_for_track()
            track = _Track(id=self._id_berikutnya, x=wrists[i][0], y=wrists[i][1])
            self._id_berikutnya += 1
            self._tracks.append(track)
            id_hasil[i] = track.id

        self._buang_kedaluwarsa()
        return [int(item) for item in id_hasil]

    def known_ids(self) -> list[int]:
        return [track.id for track in self._tracks]

    # --- bagian dalam -----------------------------------------------------
    def _mark_hilang(self, terpasang: set[int]) -> None:
        for j, track in enumerate(self._tracks):
            if j not in terpasang:
                track.hilang += 1

    def _ruang_for_track(self) -> None:
        """Panggung penuh: buang track yang paling lama tidak terlihat."""
        if len(self._tracks) < self.max_tangan:
            return
        tertua = min(
            range(len(self._tracks)),
            key=lambda j: (-self._tracks[j].hilang, self._tracks[j].id),
        )
        del self._tracks[tertua]

    def _buang_kedaluwarsa(self) -> None:
        self._tracks = [t for t in self._tracks if t.hilang <= self.hilang_maks]
