# Demo script (for a Wispr Flow screen recording)

The contest requires the build itself to be done by voice. These are good *prompts to dictate* to your coding assistant with Wispr Flow while recording, plus a 3-minute product walkthrough.

## Part 1 — build-by-voice prompts

1. "Add a `quietHours` check to the evidence scorer: if a log is recorded more than three days after its date, add a high-severity gap telling the user to note when they first learned of the event."
2. "In the notice board, add a filter chip for 'Critical path only' that shows only events flagged criticalPathLikely."
3. "Add a CSV export for the sealed log register with sequence number, date, author, evidence score and full SHA-256."
4. "Create a vitest test that proves a notice due date rolls correctly across a leap day."
5. "Add a daily digest endpoint that returns every notice due within three days across all projects."

## Part 2 — 3-minute walkthrough

1. **Landing** (0:00) — "Say what happened, prove it later." Let the hero play: dictation → event cards → notice clock → seal.
2. **Tamper test** (0:30) — edit "6 hours" to "2 hours" in entry #2; watch #2–#5 fail.
3. **Open the demo** (0:50) — Site control: overdue notices, real project.
4. **Dictate** (1:10) — *Dictate today's log*. Say (Wispr Flow into the box, or the mic):

   > "Overcast, about fifty degrees, wind picking up all afternoon. We had twelve ironworkers, eight carpenters from Atlas Framing and five laborers on site. The tower crane was shut down at two because of wind gusts, lost about four hours of steel hoisting. The architect still hasn't answered RFI 51 on the stair conflict at grid D so the carpenters can't frame the stair. Toolbox talk on wind and loose material, no incidents."

5. **Read the panel** (1:50) — wind event: weather corroborated or flagged against real measured gusts; RFI event: "hours not stated", "photo needed" → tap a gap, answer by voice; watch the evidence ring climb.
6. **Seal** (2:20) — hash types out, chained to previous entry.
7. **Notices** (2:30) — draft the notice letter; mark sent; add deadlines to calendar.
8. **Packet** (2:45) — chronology, hours by cause, integrity statement → Print.
9. **Tamper in the real app** (2:55) — *Simulate tampering*: red banner, packet turns red.
