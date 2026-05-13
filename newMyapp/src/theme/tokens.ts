export const tokens = {
  colors: {
    bg: '#0B1220',
    surface: '#111A2B',
    surfaceAlt: '#17233A',
    text: '#E7EDF7',
    textMuted: '#A6B3C8',
    primary: '#4C8DFF',
    success: '#2BB673',
    warning: '#F3B84D',
    danger: '#FF5D73',
    border: '#243553',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  typography: {
    h1: { fontSize: 28, fontWeight: '700' as const },
    h2: { fontSize: 22, fontWeight: '700' as const },
    body: { fontSize: 15, fontWeight: '400' as const },
    caption: { fontSize: 13, fontWeight: '500' as const },
  },
  elevation: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
  },
};
