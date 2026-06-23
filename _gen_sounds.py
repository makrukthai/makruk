import numpy as np, wave, struct, os

SR = 44100
os.makedirs('Sounds', exist_ok=True)

def env(n, atk=0.002, dec=0.08, power=2.0):
    a = int(SR*atk); d = n - a
    e = np.ones(n)
    if a > 0: e[:a] = np.linspace(0, 1, a)
    e[a:] = np.linspace(1, 0, d) ** power
    return e

def thock(freq=180, dur=0.075, noise=0.6, decp=2.4, vol=0.9):
    n = int(SR*dur); t = np.arange(n)/SR
    # damped low sine (the "wood" body) + short noise click (the contact)
    body = np.sin(2*np.pi*freq*t) * np.exp(-t*45)
    nz = (np.random.randn(n)) * np.exp(-t*120)
    # lowpass the noise a bit (simple moving average)
    k = 8; nz = np.convolve(nz, np.ones(k)/k, mode='same')
    sig = (1-noise)*body + noise*nz
    sig *= env(n, dec=dur, power=decp)
    return sig * vol

def tone(freqs, durs, vol=0.5, wave_t='sine'):
    parts = []
    for f, d in zip(freqs, durs):
        n = int(SR*d); t = np.arange(n)/SR
        if wave_t == 'saw':
            s = 2*(t*f - np.floor(0.5+t*f))
        else:
            s = np.sin(2*np.pi*f*t)
        s *= env(n, atk=0.004, dec=d, power=1.6)
        parts.append(s)
    sig = np.concatenate(parts) if parts else np.zeros(1)
    return sig * vol

def save(name, sig):
    sig = np.clip(sig, -1, 1)
    pcm = (sig * 32767).astype(np.int16)
    with wave.open(f'Sounds/{name}.wav', 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f'Sounds/{name}.wav  {len(sig)/SR*1000:.0f}ms')

np.random.seed(7)

# เดินปกติ — thock เบา ๆ
save('move', thock(freq=190, dur=0.07, noise=0.55, vol=0.85))

# กินหมาก — thock หนักกว่า เสียงต่ำ + crunch
cap = thock(freq=140, dur=0.11, noise=0.72, decp=2.0, vol=1.0)
save('capture', cap)

# รุก (check) — แจ้งเตือนสองโน้ตสั้น ๆ
save('check', tone([784, 1047], [0.07, 0.11], vol=0.42))

# เริ่มเกม — สองโน้ตขึ้น (perfect fifth)
save('start', tone([523, 784], [0.10, 0.16], vol=0.4))

# จบเกม — สามโน้ต (จบสวย)
save('end', tone([659, 523, 392], [0.12, 0.12, 0.24], vol=0.42))

# โปรโมท เบี้ย→เม็ด — chime ขึ้นเล็กน้อย
save('promote', tone([784, 988, 1319], [0.07, 0.07, 0.16], vol=0.38))

# ตั้งพรีมูฟ — tick สั้นเบา
save('premove', thock(freq=900, dur=0.035, noise=0.85, decp=3.0, vol=0.4))

# เดินผิดกติกา — buzz ต่ำสั้น
save('illegal', tone([160, 140], [0.06, 0.09], vol=0.35, wave_t='saw'))

print('done')
