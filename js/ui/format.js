const kmFormat = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${kmFormat.format(meters / 1000)} km`;
}

export function formatDuration(meters, speedKmh) {
  const minutes = Math.max(1, Math.round((meters / 1000 / speedKmh) * 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function formatDate(date) {
  return dateFormat.format(date);
}
