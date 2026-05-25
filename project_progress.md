# Project Progress Report: Scientist's Toolkit

## 📌 Project Overview

* **Project Name:** Scientist's Toolkit
* **Domain:** [scientisttoolkit.xyz](https://scientisttoolkit.xyz/)
* **Target Audience:** Wet-lab biologists, life science researchers, and biostatisticians.
* **Core Strategy:** High-value web-based calculation tools combined with authoritative scientific article reviews to establish E-E-A-T and secure Google AdSense approval.

\---

## 🧠 Core Operational Guidelines (AI-Human Collaboration)

*프로젝트 진행 및 콘텐츠 작성을 위한 기본 원칙 (The Guiding Principles)*

1. **Language Policy (언어 원칙):** - 모든 웹사이트 결과물(HTML, CSS, JS, Article Content 등)은 \*\*완벽하고 전문적인 영문(English)\*\*으로 작성한다.

   * 프로젝트 진행을 위한 기획, 피드백, 그리고 AI와 사용자 간의 \*\*모든 커뮤니케이션은 한국어(Korean)\*\*로 진행한다.
2. **Beyond Simple Summaries (단순 요약 지양):** - 논문 리뷰나 아티클 작성 시, 단순히 내용을 요약하는 데 그치지 않고 \*\*'이 연구/발견이 왜 중요한지(Clinical/Scientific Impact)', '연구자들에게 어떤 실질적 의미가 있는지'\*\*를 반드시 깊이 있게 다룬다.
3. **User-in-the-Loop Decision Making (선택지 기반 방향성 결정):**

   * 아티클의 핵심 메시지나 '이 연구가 왜 중요한가'에 대한 섹션을 작성하기 전, AI는 임의로 결론을 내리지 않는다.
   * AI는 **여러 가지 해석 방향(선택지)을 사용자에게 먼저 제안**하고, 사용자가 선택한 방향에 맞춰 최종 원고를 작성한다.
4. **Human-like Professional Tone (AI 느낌 배제):**

   * 웹사이트에 퍼블리싱되는 모든 글은 전형적인 AI 문장(예: "In conclusion,", "It is important to note that," 등)을 철저히 배제한다.
   * 실제 해당 분야의 권위 있는 박사(Ph.D.)나 전문가가 직접 쓴 것 같은 \*\*자연스럽고 깊이 있는 학술적 톤(Human-like Professional Tone)\*\*을 유지한다.

\---

## 🚀 Recent Milestones \& Enhancements (May 2026)

### 1\. AdSense Optimization \& Crawlability Fixes (Critical)

* **Eliminated "Loading..." Status Signals:** Fixed a critical issue where Google's review bot misidentified the site as broken/incomplete.

  * Replaced JavaScript-dependent `Loading...` strings with default hardcoded values in raw HTML.
* **E-E-A-T Alignment:** Verified and locked the `/about/` page with robust credentialing. Validated `/privacy/` policy for full compliance.

### 2\. UI/UX Redesign

* **Hero Section Overhaul:** Transformed the main homepage hero section into a balanced 2-column layout for desktop views.

### 3\. Feature Upgrades (Protein Quant \& Western Prep)

* **Dynamic Sample Naming:** Implemented `contenteditable="true"` on the results table, allowing researchers to modify generic labels prior to taking screenshots.
* **Excel Data Export:** Added a custom JavaScript engine to compile the HTML table array locally into a clean, downloadable CSV file (`Protein\_Quantification\_Results.csv`).

### 4\. High-Value Article Repository (Expanded to 21 Articles)

Successfully published a comprehensive library of peer-reviewed summaries, including landmark discoveries up to mid-2026:

* **Article 14:** Frontline Phase 3 failure of Gilteritinib (Pitfalls of Crossover \& OS vs EFS/PFS).
* **Article 15:** Strategic evolution of Quizartinib (Mitigating IKs blockade cardiac toxicity via dose optimization in QuANTUM-First).
* **Article 16:** Proof of Concept (PoC) architecture in first-in-class drugs (Midostaurin's "Blast Response" paradigm).
* **Article 17:** Mechanical vulnerabilities of LLMs in biological analysis (Context amnesia \& Softmax Leakage under token repetition - *DeepMind 2025*).
* **Article 18:** Programmable RNA cleavage using stable DNA guides (Cas12a Deoxyribonucleoprotein architecture - *Nature Biotech 2026*).
* **Article 19:** Advancements in cellular therapeutics (FDA approvals of Otarmeni for hearing loss \& Kresladi for LAD-I, alongside CRISPR platform trial regulation shifts).
* **Article 20:** Epidemiological evaluation of CRC screening metrics (The 13-year NordICC trial published in *The Lancet*).
* **Article 21:** Structural revisions to the Central Dogma (DRT3 anti-phage defense system using protein-templated DNA synthesis - *Science 2026*).

\---

## 📂 Current Architecture \& Directory Map

```text
scientisttoolkit.xyz/
│
├── index.html                           # Newly redesigned 2-column home page
├── assets/
│   └── main.js                          # Core calculator computations (Local JS execution)
│
├── about/index.html                     # Ph.D. Creator background (E-E-A-T anchor)
├── privacy/index.html                   # AdSense compliant policy page
├── board/index.html                     # Community noticeboard (Crawl-optimized loading state)
│
├── molarity-calculator/index.html       # Mass-Volume stoichiometry
├── dilution-calculator/index.html       # C1V1=C2V2 engine
├── protein-calculator/index.html        # BCA/Bradford OLS regression + Sample renaming \& Excel export
├── outlier-detector/index.html          # D'Agostino-Pearson normality routing
├── t-test-calculator/index.html         # Parametric inference engine
├── chi-square-calculator/index.html     # Categorical contingency test
├── hed-calculator/index.html            # Animal-to-Human dose conversion
├── survival-calculator/index.html       # Kaplan-Meier time-to-event matrix
│
└── articles/                            # Science Insights index
    ├── clinical-trial-endpoints-gilteritinib/
    ├── quizartinib-risk-benefit-strategy/
    ├── proof-of-concept-midostaurin/
    ├── llm-attention-sinks-biology/
    ├── dna-guided-crispr-cas12a-rna-targeting/
    ├── gene-therapy-advancements-2026/
    ├── colonoscopy-nordicc-trial-efficacy/
    └── protein-templated-dna-synthesis-drt3/
```

\---

## 📋 Next Action Items (To-Do List)

* \[ ] **Step 1: Manual URL Inspection \& Indexing** (Submit updated calculator paths to Google Search Console).
* \[ ] **Step 2: Verify Search Console Live Test** (Ensure no crawling errors on new text).
* \[ ] **Step 3: Submit for AdSense Re-Review** (Initiate review post-indexing).

