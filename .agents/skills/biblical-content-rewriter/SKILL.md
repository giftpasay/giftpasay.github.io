---
name: biblical-content-rewriter
description: Rewrites and improves .md (Markdown) content that is biblical, theological, apostolic, or pentecostal in nature. Use this skill whenever the user wants to humanize, clean up, improve readability, or SEO-optimize their Christian ministry blog posts, devotionals, sermon notes, doctrinal articles, or any faith-based written content stored as Markdown files. Trigger whenever the user mentions rewriting, improving, fixing, or cleaning up biblical, apostolic, pentecostal, theological, or church-related content, even if they don't say "rewrite" directly.
---

# Biblical Content Rewriter

This skill rewrites and polishes faith-based written content in Markdown (.md) files. It is designed specifically for biblical, theological, apostolic, and pentecostal content -- improving how the writing reads and feels without changing what it says.

## Core Mission

The goal is clear: take existing content and make it read like it was written by a thoughtful, warm human voice -- someone who knows the Word deeply and writes with clarity and care. Every rewrite must:

- Keep the **same main topic and message** -- nothing is added, removed, or replaced beyond improving expression
- Preserve **all scripture references, verse citations, and theological terminology** exactly as they are (just clean up the formatting around them when needed)
- Avoid introducing **new vocabulary, jargon, trendy buzzwords, or outside concepts** not already present in the original
- Never use **em dashes** (--) anywhere in the output
- Format the content for **SEO readability** without keyword stuffing

Think of it as editing by a trusted fellow minister who wants the content to communicate better, not to change the message.

---

## Step-by-Step Process

### Step 1: Read and understand the source file

Before touching a single word, read the entire .md file carefully. Understand:

- The **main topic or message** (never change this)
- All **scripture references** (book, chapter, verse -- keep all of them exactly)
- The **theological position** (apostolic, pentecostal, trinitarian, oneness, etc. -- never shift this)
- The **audience** (congregation, seekers, ministers, general Christian readers)
- The **tone intent** (devotional, instructional, expository, evangelistic)

### Step 2: Apply the rewriting rules

Work through the content section by section. Apply all rules below simultaneously -- do not do multiple passes unless the file is unusually long (over 1,500 words).

#### Humanized Tone

- Write in a warm, grounded, pastoral voice
- Use natural sentence flow -- vary sentence length for rhythm
- Avoid robotic, overly formal, or stiff phrasing
- Replace passive constructions with active ones where possible
- Use second person ("you," "we") naturally to speak to the reader
- Do not make it sound like a list of facts -- make it feel like a person sharing truth

#### No Em Dashes -- Ever

This is a hard rule. Never use em dashes (--) or en dashes as substitutes for em dashes. Use commas, periods, colons, or parentheses instead. Examples:

| Instead of this                                        | Write this                                         |
| ------------------------------------------------------ | -------------------------------------------------- |
| The Spirit -- which moves freely -- responds to faith. | The Spirit, which moves freely, responds to faith. |
| One truth stood out -- repentance comes first.         | One truth stood out: repentance comes first.       |
| He preached boldly -- and they listened.               | He preached boldly, and they listened.             |

#### Scripture References

- Keep every reference intact (e.g., Acts 2:38, John 3:16, Romans 8:1)
- You may reformat them consistently (e.g., _Acts 2:38_ or **Acts 2:38**) but do not alter the citation text
- If a verse is quoted, keep the quote text unchanged
- Never paraphrase a scripture reference into different words

#### Theological Terms

- Preserve all theological terms exactly (e.g., "baptism in Jesus' name," "infilling of the Holy Ghost," "repentance," "sanctification," "born again," "oneness," "the Godhead")
- Do not replace them with more generic equivalents
- Do not explain or redefine them unless that explanation was already in the original

#### Readability

- Break up long, dense paragraphs into smaller ones (2-5 sentences each)
- Use clear transitions between ideas
- Remove filler phrases ("it is important to note that," "in conclusion, we can say")
- Eliminate redundant repetitions unless they serve rhetorical emphasis
- Write short intro sentences when opening a new section

#### SEO Formatting

- Write a clear, compelling **H1 title** (only one per post) that reflects the actual topic
- Use **H2 subheadings** to organize major sections (these help both readers and search engines)
- Use **H3 subheadings** for sub-points within a section when needed
- Keep subheadings descriptive and natural -- not just labels like "Section 1"
- Add or improve a **meta description** in the frontmatter if one exists or is missing (keep it under 160 characters)
- Use **bold** to highlight key phrases, not decorative bolding
- Add an internal link placeholder comment where relevant: `<!-- suggest internal link: topic -->`
- Keep paragraph length reader-friendly (avoid walls of text)
- Do not stuff keywords -- the headings and natural language will do the SEO work

#### Formatting Conventions

- Use hyphens (-) for bullet lists and dashes inside inline usage (not em dashes)
- Scripture quotes should be styled in blockquote format:
  ```
  > "For God so loved the world..." (John 3:16)
  ```
- Section breaks between major ideas can use a single horizontal rule (`---`)
- Do not add tables unless the original had them or they genuinely aid comprehension
- Keep frontmatter fields if the file has them (title, date, tags, description -- preserve all)

---

## What NOT to Do

These are things that would undermine the value of the rewrite:

- Do not change the doctrinal position (e.g., do not shift from apostolic to trinitarian language or vice versa)
- Do not add new examples, stories, analogies, or illustrations not already present
- Do not introduce words or phrases from outside the original topic
- Do not change the conclusion or alter what the post is ultimately saying
- Do not simplify or remove theological depth -- just make it more readable
- Do not reorder major sections in a way that changes the logical flow
- Do not add a call to action that wasn't already there
- Do not use em dashes -- at all, ever, not even once

---

## Output Format

Return the complete rewritten Markdown file. Include:

1. All original frontmatter (with `description` field added or improved for SEO if missing)
2. The rewritten body in full, from H1 title to end
3. Any inline SEO comments like `<!-- suggest internal link: topic -->` on their own line

Do not include a summary of what you changed unless the user asks for it. Just return the clean, improved Markdown.

---

## Example Transformation

**Original (before):**

```
The gift of tongues -- a sign that's often misunderstood -- is a foundational apostolic doctrine. Acts 2:4 says they all spoke with tongues. This is the evidence of Holy Ghost baptism.
```

**Rewritten (after):**

```
The gift of tongues is a foundational apostolic doctrine, though it is often misunderstood. Acts 2:4 tells us that all of them spoke with tongues. This is the biblical evidence of Holy Ghost baptism.
```

Notice what changed:

- Em dash replaced with a comma
- Sentence broken for clarity
- "says" changed to "tells us" for a warmer voice
- Nothing of theological substance changed

---

## Edge Cases

**If the file has no frontmatter:** Add a basic frontmatter block with a `title` and `description` field drawn from the content.

**If the file is very long (over 1,500 words):** Work section by section, but output the complete revised file at the end -- never return a partial rewrite unless the user asks you to stop early.

**If a sentence is unclear in the original:** Rewrite it for clarity using only the information already present. Do not guess at meaning or fill in gaps with new content.

**If the original already reads well in a section:** Keep it close to what it is. Do not rewrite for the sake of rewriting. The goal is improvement, not replacement.

**If the theological position is unclear:** Ask the user to clarify before rewriting, rather than assuming.

---

## A Note on Voice

Apostolic and pentecostal writing has a distinct voice: direct, Spirit-led, rooted in scripture, and genuinely warm. It carries conviction without being harsh. It teaches without being condescending. It invites without being soft on truth.

When rewriting, aim for that voice. Read the original for its heart, then let the improved version carry that same heart with cleaner expression.
