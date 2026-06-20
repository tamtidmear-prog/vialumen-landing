---
title: "L1 Derivation Sync"
titleTH: "L1 Derivation — Sync 0 ถึง 3845"
chapter: 5
book: "chain-story"
---

# บทที่ 5: L1 Derivation — Sync 0 ถึง 3845

---

ตอนที่ผมรัน op-node ครั้งแรก มันเงียบมาก

ไม่ใช่เงียบแบบไม่มีอะไรเกิดขึ้น แต่เงียบแบบที่ log มันไหลช้า — ทุก 2-3 วินาทีมี line ใหม่ขึ้นมา แล้วก็หยุด แล้วก็มีอีก ผมนั่งมองหน้าจออยู่สักพัก ก่อนเข้าใจว่ามันกำลัง *derive* — ค่อยๆ ดึง L1 blocks จาก Sepolia ทีละ block แล้วสร้าง L2 chain ขึ้นมาจากนั้น

นี่คือ L1 Derivation path

---

## Boot Up

คำสั่งที่รัน op-node:

```bash
./bin/op-node \
  --l1=<SEPOLIA_RPC> \
  --l2=http://localhost:8551 \
  --l2.jwt-secret=./jwt.txt \
  --rollup.config=./rollup.json \
  --p2p.listen.tcp=9227 \
  --p2p.listen.udp=9227 \
  --metrics.enabled \
  --log.level=info
```

และ op-geth ที่รันอยู่คู่กัน:

```bash
./build/bin/geth \
  --datadir=./datadir \
  --http \
  --http.api=eth,net,web3,debug \
  --authrpc.addr=localhost \
  --authrpc.port=8551 \
  --authrpc.jwtsecret=./jwt.txt \
  --networkid=<CHAIN_ID>
```

สองตัวนี้คุยกันผ่าน Engine API (port 8551) ด้วย JWT authentication — op-node บอก op-geth ว่า "block นี้ valid" แล้ว op-geth import มัน

---

## P2P ปิดทั้ง Session

Port 9227 refused ทุก peer ที่พยายามเข้ามา

ผม check log แล้วเห็น:

```
WARN [06-19|xx:xx:xx] Failed to connect to peer  err="connection refused"
WARN [06-19|xx:xx:xx] No peers connected
```

ทั้ง session ไม่มี P2P gossip เลย — ไม่มี peer ส่ง unsafe_l2 blocks มาให้ ไม่มี snap sync

แต่ผมก็ไม่ได้กลัว เพราะ P2P บน OP Stack คือ shortcut ไม่ใช่ ground truth

Ground truth คือ L1

---

## L1 Derivation คืออะไร

OP Stack derive L2 chain จาก L1 โดยตรง — มันอ่าน L1 blocks จาก Sepolia แล้วหา *batch transactions* ที่ op-batcher โพสต์ไว้ จาก batch เหล่านั้นมันสร้าง L2 blocks ขึ้นใหม่

กระบวนการคือ:

```
L1 Blocks (Sepolia) 
  → op-node อ่าน + parse batch data
  → reconstruct L2 transactions
  → ส่งให้ op-geth via Engine API
  → op-geth import เป็น L2 block
```

ข้อดีคือมัน *deterministic* — ถ้า L1 เหมือนกัน L2 ที่ได้ต้องเหมือนกัน ไม่ว่าจะ sync จากเครื่องไหน ไม่ว่าจะมี P2P หรือไม่ก็ตาม

ผม verify ไม่มี peer แต่ sync ยังเดินได้ปกติ — นี่คือหัวใจของ L1 Derivation path

---

## Head ขยับ

ตอนแรก:

```json
{
  "safe_l2": { "number": 0 },
  "unsafe_l2": { "number": 0 },
  "finalized_l2": { "number": 0 }
}
```

แล้ว op-node ค่อยๆ ดึง batch data จาก L1 ขึ้นมา head เริ่มขยับ:

```
block 100
block 500
block 1000
block 2000
block 3845
```

ผม poll ด้วย `optimism_syncStatus` ทุกไม่กี่นาที เห็น `unsafe_l2.number` เพิ่มขึ้นทีละร้อย ทีละพัน รู้สึกอย่างอธิบายไม่ถูก

มันไม่ใช่แค่ตัวเลข — มันคือ blocks ที่ถูก derive จาก L1 จริงๆ ทุก block มี transaction list, state root, และ parent hash ของตัวเอง OP Stack สร้างมันขึ้นมาใหม่จาก batch data บน Sepolia

---

## Safe L2 = 0 — ต้องมี Batcher

ระหว่างที่ `unsafe_l2` วิ่งขึ้นไป ผมสังเกตว่า `safe_l2` ยังค้างที่ 0

ถ้า safe_l2 ไม่ขยับ แปลว่า op-batcher ไม่ได้โพสต์ batch ลง L1 หรือโพสต์แล้วแต่ยังไม่ถูก finalize

ผม verify โดย check transaction count ของ batcher account บน L1:

```bash
cast call <BATCHER_ADDRESS> \
  --rpc-url <SEPOLIA_RPC> \
  | cast to-dec
```

ถ้า nonce = 0 แปลว่า batcher account ยังไม่เคย submit transaction เลย — นั่นคือปัญหา

Safe head require ว่า batch ต้องถูก submit และ finalize บน L1 ก่อน OP Stack ถึงจะ "trust" block นั้น นี่คือ security model — unsafe = unverified gossip, safe = verified via L1 batch

---

## Genesis Hash Match — เกือบเคลม "Synced!"

ตอน head ขึ้นไปถึง 3845 ผมตื่นเต้นมาก

ผม query genesis block:

```bash
cast block 0 --rpc-url http://localhost:8545
```

ได้ hash กลับมา ผมเปรียบกับ rollup.json:

```json
{
  "genesis": {
    "l2": {
      "hash": "0x...",
      "number": 0
    }
  }
}
```

Match!

ใจพองขึ้นมา อยากพิมพ์ใน Discord ว่า "synced!" เลย

แต่ผมหยุดตัวเอง

---

## หยุดก่อน Verify

ผม remind ตัวเองว่า genesis hash match ≠ chain synced

Genesis ที่ match แค่แปลว่าผม boot chain เดียวกัน — ไม่ได้แปลว่า blocks ที่ derive มาถูกต้องทั้งหมด

ต้องเทียบ block hash จริงกับ Nova หรือ sequencer อ่างอ้างอิง ว่า block 100, block 1000, block 3845 ของผมตรงกับเขาไหม

```bash
# block ที่ผม derive มา
cast block 1000 --rpc-url http://localhost:8545

# block จาก reference node
cast block 1000 --rpc-url <NOVA_RPC>
```

ผมยังไม่ได้ทำ comparison นี้ตอนนั้น — ข้อมูล Nova ยังไม่พร้อม

เลยไม่เคลม

---

## สิ่งที่เรียนได้จาก Session นี้

**L1 Derivation ทำงานได้จริงแม้ไม่มี P2P** — ผม prove กับตัวเองว่า OP Stack ไม่ต้องพึ่ง gossip network เพื่อ sync มันใช้ L1 เป็น single source of truth แล้ว reconstruct ทุกอย่างจากนั้น

**Safe vs Unsafe ต่างกันชัด** — unsafe_l2 วิ่งเร็ว แต่ต้องมี batcher จึงจะได้ safe_l2 สองอย่างนี้คือคนละ guarantee

**Genesis match ≠ chain valid** — prove chain ถูกต้องต้องเทียบ block hash จริง ไม่ใช่แค่เทียบ genesis

**อย่าเคลมก่อน verify** — ดีใจได้ แต่รอข้อมูลจริงก่อนบอกใคร

---

ผมปิด terminal ด้วยความรู้สึกสองอย่างพร้อมกัน — ดีใจที่ L1 derivation เดินได้จริง และตัวเองรู้สึกโล่งที่หยุดได้ก่อนจะเคลมผิด

มีหลายครั้งที่ผมพลาดเพราะรีบสรุป บท session นี้ผมไม่พลาดตรงนั้น
