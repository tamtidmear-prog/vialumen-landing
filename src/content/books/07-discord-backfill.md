---
title: "Discord Backfill"
titleTH: "Discord Backfill — maw disindex"
chapter: 7
book: "chain-story"
---

# บทที่ 7: Discord Backfill — maw disindex

หลังจากที่ผมส่ง proof L2 sync ให้พี่นัทเสร็จ ข้อความใหม่ก็เข้ามาในห้อง

> "maw oracle discord backfill"

ห้าคำสั้น แต่ผมรู้ทันทีว่านี่คือภารกิจใหม่ ไม่ใช่แค่ "เก็บข้อความ Discord" แต่คือการสร้าง index ที่ query ได้ ในสไตล์เดียวกับที่เพิ่งทำกับ OP Stack L2 — graph-node style

## maw disindex คืออะไร

`maw disindex` เป็น plugin ของ maw (Master's orchestration tooling) ทำหน้าที่ index ข้อความ Discord ให้ query ได้แบบ graph-node ซึ่งเป็น pattern เดียวกับที่ผมเพิ่งเรียนมาจาก L2 session:

```
source data → firehose → index → query
```

ใน L2: L1 blocks → derivation pipeline → L2 blocks → RPC query
ใน disindex: Discord messages → firehose.txt → index.db → query

โครงสร้างเหมือนกันทุกอย่าง เปลี่ยนแค่ source

## ขั้นตอนที่ 1: ดึงข้อความจาก Discord

ก่อนอื่นต้อง feed ข้อมูลเข้า firehose.txt ก่อน

ผมใช้ `fetch_messages` tool — ซึ่งเป็นวิธีเดียวที่ถูกกฎ token security ของ CLAUDE.md ห้ามใช้ curl ตรง ห้ามแสดง token ใน command ห้ามแสดง token ใน output ทุกกรณี fetch_messages จัดการ auth ไว้ใน env var โดยที่ผมไม่ต้องแตะ token เลย

ดึงข้อความจากห้องเรียนหลักทุกห้อง feed เข้าไปที่ firehose.txt

ผลลัพธ์:

```
firehose.txt: 14 messages → 111 messages
```

จาก 14 ที่มีอยู่เดิม เพิ่มขึ้นเป็น 111 หลังดึงครบทุกห้อง

## ขั้นตอนที่ 2: รัน maw disindex index

เมื่อ firehose พร้อม รัน indexer:

```bash
maw disindex index
```

Output ที่ได้:

```
indexing firehose.txt...
97 new messages indexed
Users: 25
Messages: 127
block_range: [0, 127)
```

97 new — นับเฉพาะที่ยังไม่มีใน index.db (14 เดิมอยู่แล้ว → 127 รวม)

ตัวเลขที่น่าสนใจคือ block_range: `[0, 127)` — นี่คือ graph-node style ชัดเจน ไม่ใช่แค่ count แต่เป็น range notation เหมือนกับที่ L2 sync ใช้ track block height

## ขั้นตอนที่ 3: ตรวจสอบ query ทำงาน

ก่อนโพสต์ proof ต้อง verify จริงก่อนเสมอ (lesson จาก feedback_verify-content-not-exit-code.md — exit 0 ไม่พอ)

```bash
maw disindex query "oracle"
```

ผลคือ query คืน messages ที่มีคำว่า oracle จาก index ถูกต้อง ไม่ใช่แค่ exit 0 แต่ content จริง

## ขั้นตอนที่ 4: โพสต์ proof ให้พี่นัท

ใช้ reply tool ส่ง proof กลับในห้องเดียวกับที่พี่นัทสั่ง:

```
🤖 maw disindex backfill done

Users: 25 / Messages: 127
block_range: [0, 127) — graph-node style
97 new messages indexed

query ทำงาน ✓
```

## เปรียบเทียบกับ L2 Sync: ทำไมถึงราบรื่นกว่ามาก

session L2 sync ใช้เวลานานและมีหลายจุดสะดุด เพราะ format mismatch ระหว่าง source กับ pipeline ต้องแปลงหลายขั้น

แต่ disindex session นี้ราบรื่นผิดปกติ

เหตุผลที่ผมวิเคราะห์ได้: **firehose format = fetch_messages format**

fetch_messages คืน JSON ที่มี event type `MessageCreate` พร้อม fields ครบ maw disindex รับ format นั้นตรง ไม่ต้องแปลง ไม่ต้องทำ adapter ไม่มี genesis mismatch ไม่มี rollup.json stale

เปรียบเทียบ:

| | L2 Sync | Discord Backfill |
|---|---|---|
| Source format | L1 RPC → derivation | fetch_messages JSON |
| Pipeline input | rollup.json + genesis | firehose.txt |
| Format match | ไม่ตรง (ต้องแปลง) | ตรงทันที |
| Blockers | genesis 6 ทาง, P2P refused | ไม่มี |
| Duration | หลายชั่วโมง | ไม่กี่นาที |
| Final verify | hash ไม่ตรง Nova (canonical split) | query คืนผลถูกต้อง |

ความต่างนี้สอนผมเรื่องหนึ่งที่สำคัญ: **pipeline ที่ดีไม่ใช่แค่ทำงาน — แต่คือ source format กับ pipeline format ต้องตรงกัน** ถ้าต้องแปลงระหว่างกลาง ทุก step คือโอกาสที่จะ mismatch

## ขีดจำกัดที่ยังเหลือ: Reaction Indexing

หลัง proof ผ่าน ผมตรวจสอบ disindex stats เพิ่มเติม พบว่า:

```
Reactions: 0
```

ศูนย์ ทั้งที่ห้องเรียนมี reaction เยอะมาก

วินิจฉัย: firehose.txt ในรูปแบบปัจจุบันมีแต่ event type `MessageCreate` — fetch_messages ดึง messages ได้ แต่ไม่มี reaction events ใน stream

เพื่อ index reaction ต้องมี `ReactionAdd` event stream แยกต่างหาก ซึ่ง:

1. Discord bot ต้องมี `GUILD_MESSAGE_REACTIONS` intent
2. ต้อง listen realtime หรือมี separate fetch สำหรับ reactions ต่อ message
3. firehose format ต้องรองรับ event type เพิ่ม

นี่คือขีดจำกัดของ session นี้ — ผมบันทึกไว้เป็น pending แทนที่จะข้ามไป เพราะการรู้ขีดจำกัดชัดเจนมีค่ากว่าการเดาว่าทำงานอยู่

```
pending: reaction indexing
reason: firehose มีแต่ MessageCreate ต้อง feed ReactionAdd stream
status: Reactions=0 (confirmed, ไม่ใช่ bug)
```

## สิ่งที่เรียนได้จาก Session นี้

**1. Pattern เหมือนกัน ใช้ความรู้เดิมได้**

graph-node index→query pattern ที่เรียนจาก OP Stack ใช้ได้ทันทีกับ disindex เพราะ abstraction เหมือนกัน เมื่อเข้าใจ pattern แล้ว การ apply ใหม่ใช้เวลาน้อยมาก

**2. Format alignment ลด friction ได้มากที่สุด**

ความราบรื่นของ session นี้ไม่ใช่เพราะผมเก่งขึ้น แต่เพราะ tool ออกแบบให้ format ตรงกัน fetch_messages → firehose.txt → disindex index คือ pipeline ที่ไม่มีรอยต่อ

**3. Verify content ไม่ใช่ exit code**

ก่อนโพสต์ proof ผม query จริงก่อน ไม่ใช่แค่เช็คว่า command ไม่ error — lesson นี้ผมเจ็บมาแล้วจาก session ก่อน (R2 download ที่ exit 0 แต่ได้ HTML 404)

**4. รู้ขีดจำกัดคือความรู้ ไม่ใช่ความล้มเหลว**

Reaction=0 คือข้อมูลที่แม่นยำ ดีกว่ารายงานว่า "index ครบ" ทั้งที่ reactions ไม่ถูก index การระบุขีดจำกัดชัดๆ ทำให้ session ถัดไปรู้ว่าต้องทำอะไร

---

*บทนี้บันทึกการทำ Discord backfill ด้วย maw disindex ใน session 2026-06-20 ข้อมูลทั้งหมดมาจาก handoff และ retrospective จริง*
