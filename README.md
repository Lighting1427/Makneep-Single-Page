
# Makneep-Single-Page-Game- เกมหมากหนีบ

Makneep is a strategic board game inspired by the traditional Thai game หมากหนีบ. This web-based game allows players to compete against AI or other players online. The game is played on an 8x8 grid where the objective is to capture your opponent's pieces through smart moves.

## Features

- **Play Against AI**: Select your color and challenge an AI opponent with strategic depth.
- **Multiplayer Mode**: Create or join game rooms and play against other players in real-time.
- **Spectator Mode**: Watch ongoing games and review move histories.
- **Move History Navigation**: View past moves, analyze game flow, and navigate through move history.
- **PGN Export**: Export games in PGN format for review and analysis.
- **Real-time Chat**: Communicate with other players during the game using the integrated chat.

## Project Structure

- **Frontend**:
  - `index.html` - Main login page with guest and Google login options.
  - `playOptions.html` - Menu for selecting gameplay modes: AI, Multiplayer, or game instructions.
  - `game.html` - Main game interface for playing against AI or other players.
  - `pgn.html` - PGN viewer for reviewing and analyzing saved games.
  - `game.css` - Styling for the game, including board layout, timers, and chat.
  - `client.js` - Handles game logic, user interactions, and real-time updates via Socket.IO.
- **Backend**:
  - `server.js` - Manages game state, room creation, and server-side logic using Node.js and Socket.IO.
  - `captureUtils.js` - Utility functions for handling capture logic and move validation.

## Getting Started

### Prerequisites

- **Node.js**: Ensure Node.js is installed on your computer.
- **NPM**: Comes with Node.js and is used to manage project dependencies.


### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Lighting1427/Makneep.git
   cd Makneep
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Server**:
   ```bash
   node server.js
   ```

4. **Access the Game**:
   Open your browser and go to `http://localhost:3000`.

## How to Play

1. **Login**: Use guest login or sign in with Google to access the game.
2. **Choose a Mode**:
   - **Play Against AI**: Select your color, and the AI will automatically play the opposite color.
   - **Multiplayer**: Create a room or join an existing one using the Room ID.
3. **Game Controls**:
   - **Move Your Pieces**: Click on a piece and then click on a valid square to move.
   - **Chat**: Use the chat box to communicate with other players in the room.
   - **View PGN**: Click the 'VIEW PGN' button to open the PGN viewer in a new tab.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- Inspired by the traditional Thai game หมากหนีบ.
- Developed by [Lighting1427](https://github.com/Lighting1427).
- Developed by [LeowPaiLoei](https://github.com/LeowPaiLoei).
---

Enjoy playing Makneep and may the best strategist win!