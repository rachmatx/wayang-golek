# Folder model — barang dari P2

Paket P2 sudah dipasang di sini. Backend memuatnya otomatis saat start.

```
models/
  model_mlp.pkl     <- model MLP dari handoff_p2/model.pkl (default)
  model_rf.pkl      <- belum ada: P2 tidak mengirim model Random Forest
  labels.json       <- 6 label, disalin dari handoff_p2/labels.json
```

`model_mlp.pkl` adalah **Pipeline** scikit-learn
(`StandardScaler` + `MLPClassifier(128, 64)`) yang sudah berisi scaler di
dalamnya, jadi `model_service.py` memakainya langsung. Model dilatih dengan
scikit-learn 1.8.0 — versi itu yang dipin di `requirements.txt`.

`labels.json` boleh berbentuk salah satu ini:

```json
["telapak_terbuka", "kepalan", "telunjuk", "dua_jari", "jempol", "ok"]
```

```json
{ "labels": ["telapak_terbuka", "kepalan", "telunjuk", "dua_jari", "jempol", "ok"] }
```

`model_*.pkl` boleh berupa estimator scikit-learn langsung (joblib.dump),
atau dict:

```python
joblib.dump({
    "model": clf,            # wajib
    "scaler": scaler,        # opsional, kalau P2 memakai StandardScaler
    "labels": ["..."],       # opsional, menimpa labels.json
}, "model_mlp.pkl")
```

Selama folder ini kosong, backend tetap hidup dalam **mode tanpa model**
(`/api/health` -> `model_loaded: false`, WebSocket mengirim `state: unknown`).
Frontend tetap bisa didemokan lewat mode dummy.

Letak folder bisa dipindah lewat variabel lingkungan `WAYANG_MODEL_DIR`.
