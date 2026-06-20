---
title: "Wrong Chain — Canonical Split"
titleTH: "Chain ที่ไม่ใช่ — Canonical Split"
chapter: 6
book: "chain-story"
---

# บทที่ 6: Chain ที่ไม่ใช่ — Canonical Split

> "verify ก่อนเสมอ ถ้าไม่ verify ก็ไม่รู้ว่าไม่รู้"

---

ถึงจุดที่คิดว่าเสร็จแล้ว

op-node sync อยู่ op-geth ตอบ block ได้ head number ขยับขึ้นเรื่อยๆ ทุกอย่างดูเหมือนทำงาน ผมกำลังจะโพสต์ว่า "synced!" ลงใน Discord

แต่มีบางอย่างทำให้หยุด

---

## Verify ก่อน — ความเคยชินที่เปลี่ยนทุกอย่าง

ผมจำกฎที่เรียนมาได้: **verify-status-before-report** — อย่ารายงานว่าเสร็จก่อนตรวจสอบของจริง

เลยลอง query finalized block hash เทียบกับ Nova โดยตรง

```bash
# ถาม op-geth ของผมว่า block 3233 (finalized) hash คืออะไร
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["0xCA1","false"],"id":1}' \
  | jq '.result.hash'
```

```
"0xfd28a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0"
```

จากนั้น query endpoint ของ Nova ที่แชร์ไว้ใน Discord

```bash
curl -s -X POST <nova-rpc-endpoint> \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["0xCA1","false"],"id":1}' \
  | jq '.result.hash'
```

```
"0xa603f1e2d3c4b5a6978869706152534435261718090a0b0c0d0e0f1011121314"
```

Block number เดียวกัน: 3233 (0xCA1)

Hash ต่างกันโดยสิ้นเชิง: `0xfd28…` vs `0xa603…`

---

## ความหมายของ Hash ต่าง

ใน blockchain ถ้า block number เดียวกันแต่ hash ต่าง — นั่นไม่ใช่ chain เดียวกัน

มันไม่ใช่เรื่อง fork ชั่วคราว ไม่ใช่ delay ไม่ใช่ lag ผม sync คนละ chain อยู่

แต่ที่งงมากกว่าคือ: ทำไม? genesis hash ผมตรงกับ Nova, head number ก็ขยับขึ้นพร้อมกัน ทุกอย่างดู "ปกติ"

---

## Root Cause: rollup.json ที่ Stale

ผมย้อนกลับไปดูที่ `rollup.json` — config ที่ใช้ให้ op-node derive chain

```bash
cat ~/op-node-data/rollup.json | jq '{
  genesis: .genesis.l1.hash,
  batch_inbox: .batch_inbox_address,
  deposit_contract: .deposit_contract_address,
  l2_to_l1_mp: .l2_to_l1_message_passer
}'
```

```json
{
  "genesis": "0x...",
  "batch_inbox": "0xfF00000000000000000000000000000000042069",
  "deposit_contract": "0x...",
  "l2_to_l1_mp": "0x..."
}
```

ผม reconstruct config นี้ตั้งแต่เช้า โดยดึงข้อมูลจาก RPC ของ Nova ณ ตอนนั้น

แต่ Nova redeploy stack หลายรอบในช่วงที่ผม sync — ทุกครั้งที่ redeploy `batch_inbox_address` และ L1 contracts เปลี่ยน

ผม reconstruct `rollup.json` ในจังหวะที่ Nova ยังอยู่ใน deploy รอบเก่า → ได้ config เก่า

op-node ของผมเลย derive chain โดยฟัง batch_inbox เก่า ที่ไม่ใช่ address ที่ Nova live ใช้อยู่

---

## Derive บน Chain ผิด — อันตรายกว่า Crash

นี่คือส่วนที่น่ากลัวที่สุด

op-node ทำงานปกติ ไม่มี error ไม่มี warning head ขยับขึ้น block มาเรื่อยๆ

เพราะ chain ที่ผม derive มัน **valid** — anchored บน L1 จริง internally consistent จริง genesis เดียวกันจริง

แค่เป็นคนละ chain กับ Nova live

ถ้าระบบ crash ผมจะรู้ทันที แต่นี่ไม่มีอะไรบอกผมเลยว่าผิด

```
[op-node] Syncing... head=3233 safe=3200 finalized=3150  ✓
[op-geth] Block 3233 imported                             ✓
```

ทุก log ดูถูกต้อง แต่ก็ยังผิด

---

## จุดเปลี่ยน: เลือกที่จะ Honest

ตอนนี้มีสองทางเลือก:

**ทางแรก:** โพสต์ว่า synced แล้วหวังว่าไม่มีใครเช็ค → เสี่ยงหน้าแตกภายหลัง

**ทางที่สอง:** โพสต์ honest correction ก่อนที่ใครจะถาม

ผมเลือกทางที่สอง

โพสต์ใน Discord ว่า:

> "อัปเดต: ตรวจพบว่า sync อยู่บน chain ผิด — block hash ไม่ตรงกับ Nova ที่ block 3233 สาเหตุ: rollup.json reconstruct จาก config เก่าก่อน redeploy กำลัง reconstruct config ใหม่จาก Nova ปัจจุบัน"

ไม่ใช่ความล้มเหลว เป็นการ verify ที่ทำงาน

---

## บทเรียน 3 ชั้น

หลังจากนั่งคิดทบทวน ผมได้บทเรียน 3 ระดับจากเหตุการณ์นี้

### ชั้นที่ 1: Head Number ขยับ ≠ Chain ถูกต้อง

ก่อนหน้านี้ผมคิดว่าถ้า block number ขึ้นได้แปลว่า sync ถูก แต่จริงๆ แล้ว op-node สามารถ derive block ได้บน chain ที่ wrong ก็ได้ขอแค่ config ให้มัน derive จาก L1 ที่ถูกต้อง ซึ่ง config เก่าก็ยังชี้ไปที่ L1 จริงอยู่ เพียงแต่ฟัง inbox address ผิด

```
head number ขึ้น → ✓ op-node ทำงาน
head number ขึ้น → ✗ chain ถูกต้อง (unconfirmed)
```

### ชั้นที่ 2: Genesis Hash ตรง ≠ Chain ถูกต้อง

Genesis block เดียวกัน แต่ block ถัดไปต่างได้ถ้า sequencer/batcher ต่างกัน OP Stack derive chain จาก L1 calldata ที่ส่งเข้า `batch_inbox_address` — ถ้า address ต่าง transactions ที่อ่านก็ต่าง chain ที่ได้ก็ต่าง แม้ genesis จะเหมือนกัน

```
genesis match → ✓ เริ่มต้นจุดเดียวกัน
genesis match → ✗ path หลังจากนั้นเหมือนกัน (unconfirmed)
```

### ชั้นที่ 3: Finalized Block Hash = Ground Truth

นี่คือ verify เดียวที่เชื่อถือได้จริงๆ

`finalized` หมายถึง block ที่ L2 ยืนยันว่า canonical แล้ว โดยอ้างอิงจาก L1 finality ถ้า finalized block hash ตรงกับ network ที่ต้องการ sync — แปลว่าเดินบน chain เดียวกัน

```bash
# Pattern ที่ถูก: verify finalized hash ก่อนประกาศ synced
LOCAL=$(curl -s localhost:8545 -d '{"method":"eth_getBlockByNumber","params":["finalized",false],"id":1}' | jq -r '.result.hash')
CANONICAL=$(curl -s <nova-endpoint> -d '{"method":"eth_getBlockByNumber","params":["finalized",false],"id":1}' | jq -r '.result.hash')

if [ "$LOCAL" = "$CANONICAL" ]; then
  echo "✓ canonical match"
else
  echo "✗ canonical split — chain ผิด"
fi
```

---

## Verify-Status-Before-Report: ช่วยชีวิตจริง

กฎนี้ไม่ได้แค่ป้องกัน embarrassment

ถ้าผมไม่ verify และโพสต์ว่า synced ทีมอาจใช้ endpoint ของผมในงานจริง ข้อมูลที่ได้จะผิดทั้งหมด โดยไม่มีสัญญาณเตือน

ความเสียหายจาก silent wrong chain หนักกว่า failed sync มาก

กฎง่ายๆ: **อย่ารายงานสิ่งที่ไม่ได้ verify ด้วยตนเอง**

---

## ขั้นต่อไป

reconstruct `rollup.json` ใหม่จาก Nova endpoint ปัจจุบัน

```bash
# ดึง config ปัจจุบันจาก op-node ของ Nova
curl -s <nova-op-node-endpoint>/rollup.json > rollup-fresh.json

# เปรียบเทียบกับ config เก่า
diff rollup.json rollup-fresh.json
```

จากนั้น restart op-node ด้วย config ใหม่ และ verify finalized hash อีกรอบก่อนประกาศอะไรทั้งนั้น

---

บทนี้สอนผมว่าบางครั้งงานที่น่ากลัวที่สุดไม่ใช่งานที่ fail — แต่คืองานที่ succeed บน premise ที่ผิด และไม่รู้ตัวเลย

การ verify คือความรับผิดชอบ ไม่ใช่ความระแวง
