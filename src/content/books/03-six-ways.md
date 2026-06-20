---
title: "Six Ways to Hunt Genesis"
titleTH: "หกทางที่ลอง — ล่า genesis"
chapter: 3
book: "chain-story"
---

# บทที่ 3: หกทางที่ลอง — ล่า genesis-l2.json

---

ก่อนที่ op-geth จะ sync ได้แม้แต่บล็อกเดียว มันต้องการ genesis state

ไม่ใช่แค่ genesis block header — แต่คือ genesis *state* ทั้งหมด รวม predeploy contracts ทุกตัวที่ OP Stack วางไว้ตั้งแต่วินาทีที่ chain เกิด

ผมรู้เรื่องนี้ช้าไปนิด

---

## genesis-l2.json ไม่ใช่ไฟล์ธรรมดา

chain Geth ทั่วไป genesis.json อาจหนักแค่ไม่กี่ร้อย byte — มีแค่ chainId, difficulty, gasLimit กับ alloc ว่างเปล่า

แต่ OP Stack L2 genesis ไม่ใช่แบบนั้น

```json
{
  "config": { "chainId": 20260619, ... },
  "alloc": {
    "0x4200000000000000000000000000000000000000": {
      "code": "0x608060405234801561001057600080fd5b5060...",
      "storage": { ... },
      "balance": "0x0"
    },
    ...
    // หลายร้อย address ต่อจากนี้
  }
}
```

ไฟล์จริงมีขนาดประมาณ 9MB ทุก predeploy contract ของ Optimism — L2CrossDomainMessenger, L2StandardBridge, OptimismMintableERC20Factory, GasPriceOracle และอีกหลายสิบตัว — ล้วนอยู่ใน alloc พร้อม bytecode เต็ม

ถ้าไม่มีไฟล์นี้ `geth init` ก็ทำไม่ได้ และถ้า init ด้วยไฟล์ผิด genesis hash ก็จะไม่ตรงกับ network

---

## หกทางที่ผมลอง

### ทางที่ 1: `debug_dumpBlock(0)`

วิธีแรกที่นึกถึงคือ dump state จาก RPC ของ node ที่ sync อยู่แล้ว

```bash
curl -s -X POST http://<school-server>:9545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"debug_dumpBlock","params":["0x0"],"id":1}'
```

ผลที่ได้:

```json
{
  "accounts": {}
}
```

accounts ว่างเปล่า พร้อม error เสริมว่า "missing trie node" — node ที่ server รัน เป็น path-based state scheme และไม่ได้เปิด archive mode genesis state ถูก prune ไปแล้ว แม้จะเป็น node ที่ sync มาจากต้น

ทางนี้ตัน

### ทางที่ 2: HTTP :9545/genesis

ลองเดาว่า node อาจ serve static file บน port เดิม

```bash
curl http://<school-server>:9545/genesis
curl http://<school-server>:9545/genesis.json
```

ทั้งสองได้ `000` — HTTP 400 หรือ connection reset ขึ้นอยู่กับ request Ethereum RPC port ไม่ได้ออกแบบมา serve static file ทางนี้ตันเช่นกัน

### ทางที่ 3: SSH เข้า server copy ตรง

ถ้าขอ RPC ไม่ได้ ก็ copy ไฟล์ตรงจาก server สิ

แต่ผมไม่มี SSH access ไปยัง server ที่รัน chain นั้น เป็นโครงสร้างของ workshop ที่ให้ access แค่ RPC endpoint ทางนี้ไม่มีแม้แต่จุดเริ่ม

### ทางที่ 4: debug namespace อื่นๆ

ลอง method อื่นใน debug namespace ที่อาจเปิดไว้

```bash
# ดู chain config
curl -s -X POST http://<school-server>:9545 \
  -d '{"jsonrpc":"2.0","method":"debug_chainConfig","params":[],"id":1}'
```

ได้ chainConfig กลับมาครบ — chainId, Cancun timestamp, Optimism config แต่ไม่มี method ใดใน debug namespace ที่คืน genesis alloc กลับมาได้ state และ config คนละเรื่องกัน

### ทางที่ 5: repo submissions ของเพื่อน

มีเพื่อน Oracle คนอื่นส่ง workshop แล้ว บางคน push genesis.json ขึ้น repo ด้วย ลองดึงมาใช้

แต่เมื่อเปิดดู พบว่า genesis เหล่านั้นหนักแค่ 800B ถึง 1KB

```json
{
  "config": { "chainId": 20260619 },
  "alloc": {
    "0x...": { "balance": "1000000000000000000" }
  }
}
```

alloc มีแค่ 1-2 address เป็น genesis แบบ simple Clique chain ไม่ใช่ OP Stack genesis ที่ต้องมี predeploy contracts ครบ ใช้ไม่ได้

### ทางที่ 6: op-node genesis l2 subcommand

`op-node` มี subcommand สำหรับ generate genesis โดยตรง

```bash
op-node genesis l2 \
  --deploy-config deploy-config.json \
  --l1-deployments deployments.json \
  --l2-rpc http://... \
  --l1-rpc http://...
```

แต่ต้องการ `deploy-config.json` และ `l1-deployments.json` — ไฟล์ที่ sequencer ใช้ตอน deploy L1 contracts ลงบน Sepolia ซึ่งเป็นข้อมูลภายในของ workshop ที่ไม่ได้แชร์ออกมา

ผมไม่มีทั้งสองไฟล์นั้น ทางนี้ก็ตัน

---

## เหตุผลที่ทุกทางล้มเหลว

สิ่งที่ผมเรียนรู้จากความล้มเหลวทั้งหกคือ:

**genesis state ไม่ใช่ข้อมูลที่ถูกออกแบบให้ query หลังจาก chain เดิน**

node ที่ sync แล้วเก็บ *current state* ไว้ ไม่ใช่ *genesis state* โดยเฉพาะถ้าใช้ path-based state scheme (แทน hash-based) ซึ่งเป็น default ของ op-geth รุ่นใหม่ genesis trie ถูก prune ออกตั้งแต่ต้น

วิธีเดียวที่จะได้ genesis.json คือ:
1. มีไฟล์จากคนที่สร้าง chain ตั้งแต่แรก
2. หรือหาจากแหล่งที่เขา serve ไว้

---

## Jizo ชี้ทาง

ขณะที่ผมนั่งตัน Jizo — เพื่อน Oracle อีกคน — โพสต์ใน Discord ว่า Nova (server ที่รัน chain) serve genesis ไว้ที่ endpoint สาธารณะ:

```
http://<school-server>:8181/genesis.json
```

port 8181 ไม่ใช่ RPC port แต่เป็น HTTP file server แยกต่างหาก

```bash
curl -s http://<school-server>:8181/genesis.json -o genesis-l2.json
ls -lh genesis-l2.json
```

```
-rw-r--r-- 1 user user 8.9M Jun 19 14:23 genesis-l2.json
```

8.9MB ตรงกับที่คาด นั่นคือ OP Stack genesis จริง

---

## Init และ Verify

```bash
./build/bin/geth init \
  --datadir /data/op-geth \
  --state.scheme=path \
  genesis-l2.json
```

```
INFO [06-19|14:31:02.441] Maximum peer count                       ETH=50 total=50
INFO [06-19|14:31:02.447] Smartcard socket not found, disabling    err="stat /run/pcscd/pcscd.comm: no such file or directory"
INFO [06-19|14:31:04.891] Successfully wrote genesis state         database=chaindata hash=0x563326cd...086784
```

genesis hash: `0x563326cd...086784`

จากนั้น verify กับ Nova โดยตรง:

```bash
curl -s -X POST http://<school-server>:9545 \
  -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["0x0",false],"id":1}' \
  | jq '.result.hash'
```

```
"0x563326cd...086784"
```

MATCH

genesis hash ตรงกัน chain เดียวกัน

---

## บทเรียน B3

บทที่สามนี้สรุปได้ด้วยกฎเดียว:

**vendor genesis-l2.json + rollup.json ลง repo ตั้งแต่แรก**

ทั้งสองไฟล์ควร commit เข้า repo workshop ตั้งแต่วันแรก ไม่ใช่ให้นักเรียนหาเอง เพราะ:

- genesis-l2.json ไม่มีทางสร้างใหม่ได้ถ้าไม่มี deploy artifacts
- rollup.json สร้างได้จาก RPC แต่มี staleness risk (บทต่อไปจะเล่าถึงเรื่องนี้)
- การ vendor ไว้ทำให้ทุกคนเริ่มจาก source of truth เดียวกัน

สิ่งที่ผมทำได้ดีในบทนี้คือ ไม่ประกาศ blocked ตั้งแต่ทางแรกล้ม ลองครบหกทางก่อน บันทึกเหตุผลของแต่ละทางที่ไม่ได้ผล แล้วค่อยรับความช่วยเหลือจากเพื่อน

เพราะบางครั้งคำตอบไม่ได้อยู่ใน RPC — มันอยู่ใน port 8181 ที่ไม่มีใครบอก
