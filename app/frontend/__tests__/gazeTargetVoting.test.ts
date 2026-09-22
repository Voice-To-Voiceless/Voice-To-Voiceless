import { GazeTargetVoting } from '../src/vision/gazeTargetVoting';

test('resolves a short jitter sequence by majority vote', () => {
  const voting = new GazeTargetVoting<'left' | 'right'>(250);

  expect(voting.update('left', 0)).toBe('left');
  expect(voting.update('right', 80)).toBeNull();
  expect(voting.update('left', 160)).toBe('left');
});

test('ignores null candidates within the voting window and expires old samples', () => {
  const voting = new GazeTargetVoting<'left' | 'right'>(250);

  expect(voting.update('left', 0)).toBe('left');
  expect(voting.update(null, 100)).toBe('left');
  expect(voting.update(null, 251)).toBeNull();
});

test('resets candidate history', () => {
  const voting = new GazeTargetVoting<'left' | 'right'>();

  voting.update('left', 0);
  voting.reset();

  expect(voting.update('right', 1)).toBe('right');
});