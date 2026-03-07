export interface CanvasTemplate {
  id: string
  name: string
  description: string
  content: string
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start with an empty canvas',
    content: '',
  },
  {
    id: 'video-script',
    name: 'Video Script Outline',
    description: 'Structure for creating video content',
    content: `# Video Script Outline

## 🎯 Hook (0-10 seconds)
- Attention grabber
- What problem are we solving?

## 📖 Introduction (10-30 seconds)
- Who you are
- What this video is about
- Why viewers should watch

## 🎬 Main Content

### Point 1
- Key idea
- Supporting details
- Example or story

### Point 2
- Key idea
- Supporting details
- Example or story

### Point 3
- Key idea
- Supporting details
- Example or story

## 💡 Key Takeaways
- Main lesson 1
- Main lesson 2
- Main lesson 3

## 🔔 Call to Action
- What do you want viewers to do?
- Like, comment, subscribe
- Additional resources or links

## 📝 Notes
- Target length:
- Target audience:
- Tone:`,
  },
  {
    id: 'content-brief',
    name: 'Content Brief',
    description: 'Plan and outline content strategy',
    content: `# Content Brief

## 📌 Topic
_What is this content about?_

## 🎯 Target Audience
- Primary audience:
- Secondary audience:
- Pain points:
- Goals:

## 🎨 Content Goals
- [ ] Educate
- [ ] Entertain
- [ ] Inspire
- [ ] Convert

## 🔑 Key Points to Cover
1.
2.
3.
4.
5.

## 🔍 SEO Keywords
- Primary keyword:
- Secondary keywords:
  -
  -
  -

## 📊 Content Structure
### Introduction
_Hook and context_

### Main Body
_Core content and arguments_

### Conclusion
_Summary and CTA_

## 📚 Research & References
-
-
-

## ✅ Success Metrics
-
-
- `,
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm Board',
    description: 'Free-form ideation space',
    content: `# Brainstorm Session

## 💭 Topic/Challenge
_What are we brainstorming?_

---

## 💡 Ideas

### Idea 1


### Idea 2


### Idea 3


### Idea 4


### Idea 5


---

## ⭐ Top Ideas
_Mark your favorites_

1.
2.
3.

---

## 🚀 Next Steps
- [ ]
- [ ]
- [ ]

---

## 📝 Notes & Questions
`,
  },
]
