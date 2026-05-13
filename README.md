# 🪜 Ladders | Socratic AI Tutor

Ladders is a high-performance, aesthetically-driven Socratic AI tutor designed to guide students through complex problems without ever giving the answer away. Built with **Vanilla JavaScript** and powered by the **Gemini 2.5 Flash** model, it transforms static study materials into interactive, guided learning sessions.

![Ladders Preview](https://via.placeholder.com/800x400?text=Ladders+Socratic+AI+Tutor)

## ✨ Features

- **🧠 Socratic Dialogue**: Unlike traditional AI, Ladders is programmed to ask leading questions, helping you discover the solution yourself.
- **📷 Vision-Powered**: Upload images of your homework, handwritten notes, or diagrams for immediate analysis.
- **📸 Direct Camera Access**: Use your mobile device's camera to snap a photo of your work and start a session instantly.
- **🌑 Dark Academic Aesthetic**: A premium, "Dark Academic" interface designed for focus and immersion.
- **📈 Mastery Tracking**: Visualize your progress as you work through a problem.
- **⚡ High Performance**: Built with a modular Vanilla JS architecture and Vite for near-instant load times.

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS, JavaScript (ES6+ Modules)
- **Tooling**: [Vite](https://vitejs.dev/)
- **Intelligence**: [Google Gemini API](https://ai.google.dev/) (2.5 Flash)
- **Typography**: Cormorant Garamond & Inter

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- A Gemini API Key (Get one at [Google AI Studio](https://aistudio.google.com/))

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Victormarshall911/Ladders
   cd Ladders
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```bash
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   VITE_GEMINI_MODEL=gemini-2.5-flash
   ```

4. **Run for Development**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```

## 📂 Project Structure

```text
Ladders/
├── public/              # Static assets
│   └── assets/          # Icons and images
├── src/
│   ├── css/
│   │   └── style.css    # Core design system & animations
│   └── js/
│       ├── api.js       # Gemini API orchestration
│       ├── state.js     # Reactive application state
│       ├── ui.js        # DOM components & event helpers
│       └── main.js      # Application entry point
├── .env                 # Secrets (ignored by git)
├── index.html           # Main entry
└── package.json         # Scripts and dependencies
```

## 📜 System Instruction

The "Socratic Ghost" operates under a strict behavioral protocol:
> "You are the Socratic Ghost. Your goal is to guide the student to the answer by asking leading questions. Never provide the solution, even if asked. Break the problem into the smallest possible logical steps. Keep your tone academic, mystical, and encouraging."

## 🤝 Contributing

Contributions are welcome! If you have ideas for new pedagogical patterns or UI enhancements, feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Built for the seekers of knowledge.*
