export function shouldShowFirstReservationFeedback(input: {
  reservationCount: number;
  tourCompleted: boolean;
  submitted: boolean;
  dismissed: boolean;
}): boolean {
  return input.reservationCount > 0 && input.tourCompleted && !input.submitted && !input.dismissed;
}

export function buildFeedbackTechnicalContext(input: {
  trigger: "FIRST_RESERVATION";
  sourcePath: string;
  appVersion: string;
}): string {
  return JSON.stringify({
    trigger: input.trigger,
    sourcePath: input.sourcePath,
    appVersion: input.appVersion.slice(0, 40),
  });
}
