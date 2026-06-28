'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

/**
 * ChessGame - Renders an interactive chessboard.
 * CRITICAL: This component never mutates the `game` prop.
 * All move validation is done on a temporary copy.
 * The parent is responsible for updating game state via `onMove`.
 *
 * react-chessboard v5.x API:
 *   <Chessboard options={{ position, onPieceDrop, onSquareClick, ... }} />
 *   - onSquareClick({ piece, square })
 *   - onPieceDrop({ piece, sourceSquare, targetSquare }) => boolean
 *   - onSquareRightClick({ piece, square })
 *   - allowDragging (replaces arePiecesDraggable)
 *   - squareStyles (replaces customSquareStyles)
 *   - boardOrientation 'white' | 'black'
 *   - animationDurationInMs (replaces animationDuration)
 */
export default function ChessGame({
  game,
  onMove,
  boardWidth = 560,
  orientation = 'white',
  allowMoves = true,
  highlightSquares = {},
  arrowsOnBoard = [],
  onSquareClick,
}) {
  const [moveFrom, setMoveFrom] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const [rightClickedSquares, setRightClickedSquares] = useState({});

  const gameRef = useRef(game);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    gameRef.current = game;
    onMoveRef.current = onMove;
  }, [game, onMove]);

  // Get legal moves for highlighting (read-only, no mutation)
  const getMoveOptions = useCallback(
    (square) => {
      const currentGame = gameRef.current;
      if (!currentGame || !allowMoves) return false;
      const moves = currentGame.moves({ square, verbose: true });
      if (moves.length === 0) {
        setOptionSquares({});
        return false;
      }

      const newSquares = {};
      moves.forEach((move) => {
        newSquares[move.to] = {
          background:
            currentGame.get(move.to) && currentGame.get(move.to).color !== currentGame.get(square).color
              ? 'radial-gradient(circle, rgba(0,0,0,0.1) 85%, transparent 85%)'
              : 'radial-gradient(circle, rgba(0,0,0,0.15) 25%, transparent 25%)',
          borderRadius: '50%',
        };
      });
      newSquares[square] = {
        background: 'rgba(255, 255, 0, 0.4)',
      };
      setOptionSquares(newSquares);
      return true;
    },
    [allowMoves]
  );

  // Try a move on a COPY — never mutate the prop
  const tryMove = useCallback(
    (from, to) => {
      const currentGame = gameRef.current;
      if (!currentGame) return null;
      const copy = new Chess(currentGame.fen());
      try {
        const result = copy.move({ from, to, promotion: 'q' });
        return result; // null if illegal
      } catch (e) {
        return null;
      }
    },
    []
  );

  // v5 API: onSquareClick receives { piece, square }
  const handleSquareClick = useCallback(
    ({ square }) => {
      if (!allowMoves) {
        if (onSquareClick) onSquareClick(square);
        return;
      }

      setRightClickedSquares({});

      if (!moveFrom) {
        const hasMoves = getMoveOptions(square);
        if (hasMoves) setMoveFrom(square);
        return;
      }

      const moveResult = tryMove(moveFrom, square);
      if (moveResult) {
        setMoveFrom(null);
        setOptionSquares({});
        setTimeout(() => {
          if (onMoveRef.current) onMoveRef.current(moveResult);
        }, 0);
      } else {
        // Clicked a different piece?
        const hasMoves = getMoveOptions(square);
        setMoveFrom(hasMoves ? square : null);
      }
    },
    [moveFrom, allowMoves, onSquareClick, getMoveOptions, tryMove]
  );

  // v5 API: onPieceDrop receives { piece, sourceSquare, targetSquare } => boolean
  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }) => {
      if (!allowMoves) return false;
      const moveResult = tryMove(sourceSquare, targetSquare);
      if (moveResult) {
        setMoveFrom(null);
        setOptionSquares({});
        setTimeout(() => {
          if (onMoveRef.current) onMoveRef.current(moveResult);
        }, 0);
        return true;
      }
      return false;
    },
    [allowMoves, tryMove]
  );

  // v5 API: onSquareRightClick receives { piece, square }
  const handleSquareRightClick = useCallback(({ square }) => {
    const color = 'rgba(0, 0, 255, 0.4)';
    setRightClickedSquares((prev) => ({
      ...prev,
      [square]: prev[square]
        ? undefined
        : { backgroundColor: color },
    }));
  }, []);

  const mergedSquareStyles = useMemo(() => ({
    ...highlightSquares,
    ...optionSquares,
    ...rightClickedSquares,
  }), [highlightSquares, optionSquares, rightClickedSquares]);

  const boardOptions = useMemo(() => ({
    position: game ? game.fen() : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
    boardOrientation: orientation,
    allowDragging: allowMoves,
    animationDurationInMs: 200,
    squareStyles: mergedSquareStyles,
    darkSquareStyle: { backgroundColor: '#779556' },
    lightSquareStyle: { backgroundColor: '#ebecd0' },
    onSquareClick: handleSquareClick,
    onPieceDrop: handlePieceDrop,
    onSquareRightClick: handleSquareRightClick,
  }), [game, orientation, allowMoves, mergedSquareStyles, handleSquareClick, handlePieceDrop, handleSquareRightClick]);

  return (
    <div className="board-container" id="chess-board" style={{ width: `${boardWidth}px`, maxWidth: '100%' }}>
      <Chessboard options={boardOptions} />
    </div>
  );
}
