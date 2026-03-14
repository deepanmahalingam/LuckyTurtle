export class BallAnimator {
  static getBallClass(num) {
    if (num <= 9) return 'ball-red';
    if (num <= 19) return 'ball-amber';
    if (num <= 29) return 'ball-green';
    if (num <= 39) return 'ball-blue';
    return 'ball-purple';
  }

  static createBall(num, size = 'normal', animate = false) {
    const ball = document.createElement('div');
    const sizeClass = size === 'small' ? 'ball-sm' : '';
    const animClass = animate ? 'ball-animate' : '';
    ball.className = `lottery-ball ${BallAnimator.getBallClass(num)} ${sizeClass} ${animClass}`.trim();
    ball.textContent = num;
    ball.title = `Number ${num}`;
    return ball;
  }

  static renderBalls(container, numbers, options = {}) {
    const { size = 'normal', animate = true, clear = true } = options;

    if (clear) container.innerHTML = '';

    const fragment = document.createDocumentFragment();
    for (const num of numbers) {
      fragment.appendChild(BallAnimator.createBall(num, size, animate));
    }
    container.appendChild(fragment);
  }

  static renderBallsWithDelay(container, numbers, delayMs = 150) {
    container.innerHTML = '';
    numbers.forEach((num, i) => {
      setTimeout(() => {
        container.appendChild(BallAnimator.createBall(num, 'normal', true));
      }, i * delayMs);
    });
  }
}
