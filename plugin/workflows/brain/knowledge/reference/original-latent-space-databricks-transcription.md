# ORIGINAL: Latent Space Podcast — Databricks Founders (raw, as provided)
TYPE: raw transcription
DATE: 2026-06-26
SOURCE: Latent Space podcast — Matei Zaharia & Reynold Xin (Databricks founders)

---

**Reynold Xin:** One of the theses we have is actually once you can get the data in the right place, the AI models are becoming pretty good. The generic agents have pretty good reasoning capabilities; many traditional software paradigms will be rewritten with this new paradigm: get the data there and slap some agent on top to make magic happen.

**Host:** Matt and Reynold from Databricks, welcome. The first summit you ran had just 50 people, and now it's 100,000 around the world. Was it obvious back then that **Ali Ghodsi** would be such a great CEO?

**Matei Zaharia:** Among the founders, it was clear he'd be the best at this. He ramped up on every topic—finance, sales—by studying and talking to experts.

**Reynold Xin:** He has very high IQ and EQ. The Ali of today is different from 10 years ago; he put in a lot of work to get to this point.

**Host:** You launched several things: **Omni**, **LTAP**, **Genie**, and acquired **Panther**. Let's start with Omni and the concept of "metahornness."

**Matei Zaharia:** There were converging lines. We had internal coding infra called **Isaac** and we were building customer agents like **Genie**. Advanced engineers were building their own workflows but needed a way to switch models, share sessions, and have collaboration layers. It turns out coding agents and custom agents face the same problems: the need for security, delivery, and portability.

**Matei Zaharia:** This ties back to **network protocols** like the Internet Protocol. We want interoperability where multiple parties moving at different speeds can coordinate.

**Reynold Xin:** I remember one week I was coding non-stop, even tethering my laptop to my phone while driving to a doctor's appointment. I realized we needed **cloud sandboxes** that don't shut down and allow for persistent development.

**Matei Zaharia:** The first prototype just had chats, but Reynold insisted on being able to open a shell, list files, and render markdown files. We built **Omni** so you can have a collaborative server with security, like logging in with Google to share sessions safely.

**Matei Zaharia:** We open-sourced it because we believe a layer that benefits from a network effect and community integrations will win in the long run. Already, we're seeing pull requests for **Kubernetes** support and various cloud sandboxes.

**Reynold Xin:** Regarding the **modern data stack**, it was decomposed into ingestion, transformation, and visualization. Eventually, customers pushed for consolidation so they didn't have to work with five different vendors.

**Matei Zaharia:** Omni provides a **common API** on top of all harnesses. Whether it's OpenAI SDK or others, we map them to the same interface so you don't have to maintain it yourself.

**Host:** Regarding **compute sandboxing**, every database company is also a compute company.

**Reynold Xin:** Our sandbox solution works because we took our **lake-based architecture** and removed the database. We needed local persistence so libraries don't have to be reinstalled every time. On the analytics side, we launch **50 to 60 million virtual machines a day** across three clouds, processing exabytes of data.

**Matei Zaharia:** On the **security and control** side, there's a tension between usability and security. We decided we need **contextual policies**. For example, should an agent be able to read confidential docs *and* publish to a website? Probably not, due to prompt injection risks. We track the state of the session to govern these actions.

**Matei Zaharia:** We also track **token budgets**. You can launch a sub-agent and cap its spend at $5, requiring permission to continue. This combines my experience with **Unity Catalog** (data governance) and my annoyance with coding agents.

**Host:** Tell the story of **LTAP** and the "dream engine."

**Reynold Xin:** Databases are split into **OLTP** (transactional/row-oriented) and **OLAP** (analytical/column-oriented). Moving data via **CDC (Change Data Capture)** is brittle and painful—we joke it stands for "Continuous Data Corruption". **LTAP** unifies the storage layer.

**Reynold Xin:** One of our engineers prototyped it: instead of row-oriented format, he wrote to the lake in **Parquet** (column-oriented). He used **idle CPUs** in the storage fleet to do the transcoding, which actually made writes faster because of better compression.

**Reynold Xin:** Most database engines are a decade old and full of hacked-around abstractions. We decided to rewrite from scratch, hiring experts who had built multiple systems to avoid **"second system syndrome"**.

**Reynold Xin:** We built a **"factory"** for the database that uses a machine learning model (trained on a quadrillion trace data points) to predict the best algorithm for a query based on data sparsity, latency, and memory. This allows us to dispatch the right algorithm at runtime.

**Host:** How have you succeeded where **Snowflake** failed?

**Reynold Xin:** Two big differences: **openness** (we never had a proprietary format) and **AI**. We started "upstream" with bulk processing and map-reduce-like scales with Spark.

**Matei Zaharia:** When we acquired **Mosaic AI**, our focus wasn't just training a general frontier model. We focus on making models useful for querying data, like our **Genie** agent. We also build specialized models for high-volume cases, like **document parsing**, which is 100x cheaper and better than general models.

**Matei Zaharia:** I agree with **Satya Nadella** that data and context are becoming more valuable with AI. It's about using agents to make decisions based on existing data history.

**Reynold Xin:** Our thesis remains: get the data in the right place, and **slap some agent on top**; the magic will come out.
