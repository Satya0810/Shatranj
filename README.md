# Shatranj (ChessMaster)

A feature-rich chess application built with [Next.js](https://nextjs.org), offering gameplay, AI analysis, and puzzle solving.

## Features

- **Play Computer**: Play against a built-in chess engine.
- **Game Analysis**: Import PGNs or analyze your games with Stockfish, including deep evaluation, best moves, and engine lines.
- **Puzzles**: Solve chess puzzles to improve your tactical skills.
- **User Authentication**: Secure login, signup, and OAuth (Google) functionality.
- **Real-time Capabilities**: Built with Socket.io for interactive features.

## Technologies Used

- **Framework**: Next.js (App Router)
- **Frontend**: React, React Chessboard
- **Backend/Database**: Node.js, Mongoose (MongoDB)
- **Chess Engine & Logic**: Chess.js
- **Real-time**: Socket.io
- **Authentication**: JWT, bcryptjs, Google OAuth
- **Email Services**: Nodemailer

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
# or
npm start
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Environment Variables

To run this project locally, you will need to set up your environment variables. 
Create a `.env.local` file in the root directory and ensure all required API keys, Database URIs, and Secrets are configured (e.g., MongoDB URI, JWT Secret, Google Client ID/Secret).

## Deployment

The easiest way to deploy this Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
