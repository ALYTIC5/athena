"""Generate the synthetic Lab B data: labs/rag-evals/data/memories.jsonl and queries_seed.jsonl.

Maintainers only. Run with: python scripts/gen_lab_b_data.py
Everything is invented. The output is deterministic (fixed seed), so re-running it changes nothing.

Design:
- 20 hand-written "key" memories (a few queries have two relevant memories) carry the labels.
- About 280 filler memories come from topic templates. Each topic has "forbidden" facts that only the
  key memories state, so no filler memory is accidentally relevant to a seed query.
- Several queries paraphrase their memory (SMS vs "text message", "peanut" vs "nut"), so a plain keyword
  baseline reaches the 80% threshold but not 100%.
"""

from __future__ import annotations

import json
import random
import re
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "labs" / "rag-evals" / "data"
TARGET = 300

# (caller name, memory text). Topic tags keep fillers from contradicting a key caller.
KEYS: dict[str, tuple[str, str, str]] = {
    # key: (caller, topic, text)
    "tuesday_am": ("Priya Nair", "schedule", "Priya Nair prefers Tuesday morning appointments because her bus service is less frequent after noon."),
    "tuesday_am_2": ("Gareth Pugh", "schedule", "Gareth Pugh asked for a Tuesday morning slot every month so he can drop his daughter at school first."),
    "penicillin": ("Tomas Brandt", "allergy", "Tomas Brandt mentioned a penicillin allergy and asked that it be written on his file."),
    "sms_only": ("Lena Okafor", "contact", "Lena Okafor asked for reminders by SMS only and does not want to be phoned."),
    "dog_biscuit": ("Marcus Webb", "pet", "Marcus Webb's dog Biscuit sometimes barks during calls, so he apologises in advance."),
    "wheelchair": ("Grace Mbeki", "access", "Grace Mbeki uses a wheelchair and needs a ground floor room with step-free entry."),
    "portuguese": ("Ines Duarte", "language", "Ines Duarte is more comfortable in Portuguese and asked for a Portuguese-speaking agent when possible."),
    "double_charge": ("Oliver Hart", "complaint", "Oliver Hart complained that his card was charged twice for the March invoice; a refund was promised within five working days."),
    "family_emergency": ("Hannah Sorensen", "cancel", "Hannah Sorensen cancelled at short notice after a death in the family and asked not to be charged."),
    "neighbour": ("Ravi Menon", "referral", "Ravi Menon found the business through a recommendation from his neighbour Aisha."),
    "electric_car": ("Sofia Ricci", "vehicle", "Sofia Ricci arrives in an electric vehicle and asked whether a charger is available on site."),
    "bank_transfer": ("Daniel Kowalski", "payment", "Daniel Kowalski prefers to settle invoices by bank transfer and does not keep a card on file."),
    "after_6pm": ("Mei Tanaka", "hours", "Mei Tanaka can only take calls after 6pm because of her shift pattern."),
    "peanut": ("Fatima Rahman", "allergy", "Fatima Rahman has a severe peanut allergy and asked that the catering order avoids all nuts."),
    "moving_june": ("Callum Reid", "move", "Callum Reid is relocating to a new flat at the start of June and will send his new address then."),
    "hard_of_hearing": ("Edith Walsh", "access", "Edith Walsh is hard of hearing, so staff should speak slowly and repeat the date and time."),
    "anniversary": ("Jamal Okoye", "event", "Jamal Okoye arranged an anniversary surprise for his wife and asked staff not to mention it on the phone."),
    "technician_sam": ("Beatrice Lang", "technician", "Beatrice Lang always asks for Sam because he fixed her boiler properly the first time."),
    "late_fee": ("Viktor Petrov", "billing", "Viktor Petrov disputed the late fee on his last statement and says he never received the reminder."),
    "night_shift": ("Amara Eze", "hours", "Amara Eze works nights at a hospital and sleeps until early afternoon, so no calls before 2pm."),
    "newsletter": ("Noah Fischer", "marketing", "Noah Fischer asked to be removed from the marketing newsletter after receiving three emails in one week."),
}

# query id, query text, keys whose memories are relevant
QUERIES: list[tuple[str, str, list[str]]] = [
    ("q01", "who prefers Tuesday morning appointments", ["tuesday_am", "tuesday_am_2"]),
    ("q02", "caller with a penicillin allergy", ["penicillin"]),
    ("q03", "wants reminders by text message and not phone calls", ["sms_only"]),
    ("q04", "caller whose dog barks during the call", ["dog_biscuit"]),
    ("q05", "needs step-free access because of a wheelchair", ["wheelchair"]),
    ("q06", "asked to speak Portuguese", ["portuguese"]),
    ("q07", "complained about being charged twice on an invoice", ["double_charge"]),
    ("q08", "cancelled after a bereavement and asked for no fee", ["family_emergency"]),
    ("q09", "heard about us from a neighbour", ["neighbour"]),
    ("q10", "needs somewhere to plug in the car", ["electric_car"]),
    ("q11", "pays by bank transfer instead of card", ["bank_transfer"]),
    ("q12", "can only be called after 6pm", ["after_6pm"]),
    ("q13", "nut allergy catering", ["peanut"]),
    ("q14", "moving house in June", ["moving_june"]),
    ("q15", "struggles to catch what is said on the phone", ["hard_of_hearing"]),
    ("q16", "secret anniversary surprise", ["anniversary"]),
    ("q17", "always wants the same technician Sam", ["technician_sam"]),
    ("q18", "disputed a late fee", ["late_fee"]),
    ("q19", "works night shifts so avoid morning calls", ["night_shift"]),
    ("q20", "asked to unsubscribe from the newsletter", ["newsletter"]),
]

OTHER_CALLERS = [
    "Aoife Brennan", "Chidi Obi", "Dmitri Volkov", "Elena Rossi", "Farid Haddad", "Greta Lindqvist",
    "Hugo Martin", "Isla Campbell", "Jun Park", "Kwame Asante", "Leila Karimi", "Mateo Vargas",
    "Nadia Petrova", "Owen Thomas", "Petra Novak", "Quinn Harper", "Rosa Delgado", "Samir Patel",
    "Tilly Brooks", "Umar Sheikh", "Vera Lund", "Wei Zhang", "Xavier Dupont", "Yasmin Qureshi",
    "Zoltan Kiss", "Alba Torres", "Bram de Vries", "Carys Evans", "Dara Nolan", "Esme Whitaker",
]

# topic -> list of sentence templates ({n} = caller name). None of these states a key fact.
FILLER: dict[str, list[str]] = {
    "schedule": [
        "{n} prefers {day} {part} appointments.",
        "{n} usually books on a {day} {part} and dislikes changes at short notice.",
        "{n} asked for a {day} {part} slot whenever one is free.",
    ],
    "allergy": [
        "{n} is allergic to {thing} and asked that it is noted on the account.",
        "{n} mentioned a {thing} allergy during the last visit.",
    ],
    "contact": [
        "{n} prefers email to phone calls.",
        "{n} wants all messages sent to a work email address.",
        "{n} asked for confirmations by post because the internet at home is unreliable.",
        "{n} is happy to be called on a mobile at any time during office hours.",
    ],
    "pet": [
        "{n} has a {pet} called {pname} and sometimes brings it to appointments.",
        "{n} mentioned that {pname}, the {pet}, has been unwell lately.",
    ],
    "payment": [
        "{n} pays by credit card and wants a receipt each time.",
        "{n} set up a direct debit last year and asked about changing the date.",
        "{n} asked whether invoices can be split into two monthly payments.",
        "{n} likes to pay in person on the day of the visit.",
    ],
    "access": [
        "{n} prefers documents in large print.",
        "{n} needs extra time to read forms and asked staff not to rush.",
        "{n} uses a screen reader and asked for plain text emails.",
        "{n} finds loud waiting rooms stressful and asked for a quiet seat.",
    ],
    "language": [
        "{n} would like conversations in {lang} when an agent is available.",
        "{n} speaks {lang} at home and sometimes needs a term explained in English.",
    ],
    "complaint": [
        "{n} complained that {issue}.",
        "{n} was unhappy that {issue} and asked for a manager to call back.",
    ],
    "cancel": [
        "{n} cancelled the booking because of {why}.",
        "{n} rescheduled two times this spring because of {why}.",
    ],
    "referral": [
        "{n} found the business through {src}.",
        "{n} said {src} is how they first heard of us.",
    ],
    "vehicle": [
        "{n} arrives by {how} and asked where to leave it.",
        "{n} travels by {how} and is sometimes a few minutes late.",
    ],
    "hours": [
        "{n} is easiest to reach at lunchtime.",
        "{n} works weekends and asked for calls on weekday afternoons.",
        "{n} usually has meetings until noon and prefers a callback later in the day.",
    ],
    "move": [
        "{n} is relocating in {month} and will confirm the new address later.",
        "{n} mentioned a house move planned for {month}.",
    ],
    "event": [
        "{n} is organising a family reunion in {month} and asked about group bookings.",
        "{n} booked a retirement party for a colleague and asked for a quiet room.",
    ],
    "technician": [
        "{n} asked for {tech} again because the last visit went well.",
        "{n} was happy with {tech} and would like the same engineer next time.",
    ],
    "billing": [
        "{n} asked for a copy of last year's invoices to send to an accountant.",
        "{n} wants the company name on every invoice instead of a personal name.",
        "{n} asked why the price changed since the previous quote.",
    ],
    "marketing": [
        "{n} is happy to receive occasional offers by email.",
        "{n} asked to hear about new services first.",
    ],
}

POOLS = {
    "day": ["Monday", "Wednesday", "Thursday", "Friday"],
    "part": ["morning", "afternoon", "evening"],
    "thing": ["shellfish", "latex", "pollen", "bee stings", "aspirin", "dust mites", "eggs", "sulphites", "ibuprofen"],
    "pet": ["cat", "rabbit", "parrot", "spaniel", "tortoise"],
    "pname": ["Pepper", "Mochi", "Clover", "Juno", "Ziggy", "Maple", "Otis", "Pickle"],
    "lang": ["Spanish", "Polish", "Welsh", "French", "Hindi", "Italian"],
    "issue": [
        "they waited forty minutes on hold",
        "the engineer arrived two hours late",
        "the wrong item was delivered",
        "the confirmation email had the wrong date",
        "nobody returned a promised call",
    ],
    "why": ["a work trip", "illness", "a clash with school holidays", "a broken car", "a change of plans"],
    "src": ["an online search", "a leaflet through the door", "a local newspaper advert", "a recommendation from a colleague", "a trade fair"],
    "how": ["bus", "bicycle", "van", "taxi", "train"],
    "month": ["September", "October", "August", "November"],
    "tech": ["Priyanka", "Tobias", "Lucia", "Mo"],
}

# Words a filler memory must never contain, because they belong to a key fact.
FORBIDDEN = [
    "tuesday", "penicillin", "sms", "text message", "biscuit", "wheelchair", "portuguese", "twice",
    "death", "bereave", "neighbour", "electric", "bank transfer", "after 6pm", "peanut", "nuts",
    "june", "hard of hearing", "anniversary", "sam", "late fee", "night", "newsletter", "unsubscribe",
]


def fill(template: str, name: str, rng: random.Random) -> str:
    out = template.replace("{n}", name)
    for key, values in POOLS.items():
        token = "{" + key + "}"
        while token in out:
            out = out.replace(token, rng.choice(values), 1)
    return out


def main() -> None:
    rng = random.Random(20261)
    key_topics = {caller: topic for caller, topic, _ in KEYS.values()}
    callers = sorted({c for c, _, _ in KEYS.values()} | set(OTHER_CALLERS))

    memories: list[dict[str, str]] = []
    seen_text: set[str] = set()
    for key, (caller, _topic, text) in KEYS.items():
        memories.append({"key": key, "caller_name": caller, "text": text})
        seen_text.add(text)

    attempts = 0
    while len(memories) < TARGET:
        attempts += 1
        if attempts > 20000:
            raise SystemExit("could not generate enough unique filler memories")
        caller = rng.choice(callers)
        topic = rng.choice(sorted(FILLER))
        if key_topics.get(caller) == topic:
            continue  # do not contradict a key fact for this caller
        text = fill(rng.choice(FILLER[topic]), caller, rng)
        low = text.lower()
        if text in seen_text or any(re.search(rf'{re.escape(word)}', low) for word in FORBIDDEN):
            continue
        seen_text.add(text)
        memories.append({"key": "", "caller_name": caller, "text": text})

    rng.shuffle(memories)
    start = date(2026, 1, 5)
    dates = sorted(start + timedelta(days=rng.randrange(0, 270)) for _ in memories)
    caller_ids = {name: f"caller_{i:02d}" for i, name in enumerate(callers, start=1)}

    rows: list[dict[str, str]] = []
    key_to_id: dict[str, str] = {}
    for i, (m, d) in enumerate(zip(memories, dates, strict=True), start=1):
        mem_id = f"mem_{i:03d}"
        if m["key"]:
            key_to_id[m["key"]] = mem_id
        rows.append(
            {
                "id": mem_id,
                "caller_id": caller_ids[m["caller_name"]],
                "caller_name": m["caller_name"],
                "created_at": d.isoformat(),
                "text": m["text"],
            }
        )

    ROOT.mkdir(parents=True, exist_ok=True)
    (ROOT / "memories.jsonl").write_text(
        "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8"
    )
    queries = [
        {"query_id": qid, "query": text, "relevant_ids": sorted(key_to_id[k] for k in keys)}
        for qid, text, keys in QUERIES
    ]
    (ROOT / "queries_seed.jsonl").write_text(
        "".join(json.dumps(q, ensure_ascii=False) + "\n" for q in queries), encoding="utf-8"
    )
    print(f"wrote {len(rows)} memories and {len(queries)} seed queries to {ROOT}")


if __name__ == "__main__":
    main()
