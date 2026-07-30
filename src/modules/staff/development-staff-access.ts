export function isDevelopmentStaffAccessAllowed(
  environment: { NODE_ENV?: string } = process.env,
): boolean {
  return (
    environment.NODE_ENV === "development" || environment.NODE_ENV === "test"
  );
}
