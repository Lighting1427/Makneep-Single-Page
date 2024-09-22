export function startTimer(duration, display) {
  clearInterval(display.interval); 
  display.remainingTime = duration;
  updateTimerDisplay(display);
  display.interval = setInterval(() => {
      if (display.remainingTime > 0) {
          display.remainingTime--;
          updateTimerDisplay(display);
      } else {
          clearInterval(display.interval); 
      }
  }, 1000);
}

export function resetTimer(duration, display) {
  clearInterval(display.interval);
  display.remainingTime = duration;
  updateTimerDisplay(display);
}

export function pauseTimer(display) {
  clearInterval(display.interval);
}

export function resumeTimer(display) {
  if (display.remainingTime > 0) {
      clearInterval(display.interval); 
      display.interval = setInterval(() => {
          if (display.remainingTime > 0) {
              display.remainingTime--;
              updateTimerDisplay(display);
          } else {
              clearInterval(display.interval);
          }
      }, 1000);
  }
}

