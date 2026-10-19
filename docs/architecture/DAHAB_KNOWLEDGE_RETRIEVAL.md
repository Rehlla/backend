# DAHAB KNOWLEDGE RETRIEVAL & SEARCH ARCHITECTURE
**Document ID**: `DOC-ARCH-2026-DKOS-RETRIEVAL`  
**Classification**: Hybrid Search, Intent Extraction & Query Execution  
**Version**: 2026.1  

---

## 1. Unified Search Pipeline

```
  [ Traveler Natural Language Query: "أنا في اللايتهاوس ومعايا ساعتين وعايز حاجة هادية وبعدها أكل" ]
                                      ↓
  1. INTENT & CONSTRAINT EXTRACTION (Gemini 3.7 semantic parser + regex fallback)
     - Origin: `lighthouse`
     - Window: `120 minutes`
     - Pace / Style: `Relaxed / Quiet`
     - Intent Sequence: `[Activity, Food]`
                                      ↓
  2. STRUCTURED FILTER GENERATION
     - Geographic Zone: `['lighthouse', 'masbat', 'eel_garden']`
     - Max Duration: `60 - 75 min` (allowing transit + food buffer)
     - Status: `VERIFIED_OPERATIONAL` & `ACTIVE`
                                      ↓
  3. CANDIDATE RETRIEVAL (Cloud SQL relational indexed lookup + text similarity)
                                      ↓
  4. TRANSIT & AVAILABILITY GATING
     - Walk/Transit buffer checked via Geointelligence
     - Booking / Walk-in eligibility verified
                                      ↓
  5. DETERMINISTIC RANKING & EXPLANATION
     - Scores calculated across 6 dimensions
     - Formats max 3 top recommendations with machine-readable `whyMatched`
```
