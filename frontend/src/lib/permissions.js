// Which roles may open which screens. Single source of truth for both the sidebar
// (components/Layout.jsx) and the route guard (App.jsx). The backend still enforces
// real authorisation on every API call; this keeps the UI consistent with it.

export const ALL_ROLES = ['admin', 'procurement_manager', 'store_keeper', 'store_manager', 'chef', 'management'];

export const ROUTE_ROLES = {
  '/': ALL_ROLES,
  '/sales': ['admin', 'chef', 'store_manager', 'management'],
  '/procurement': ['admin', 'procurement_manager', 'store_keeper', 'management'],
  '/inventory': ['admin', 'store_keeper', 'store_manager', 'chef', 'management'],
  '/kitchen': ALL_ROLES,
  '/recipes': ['admin', 'chef', 'management'],
  '/rd': ['admin', 'chef', 'management'],
  '/wastage': ['admin', 'chef', 'store_manager', 'management'],
  '/masters': ['admin'],
  '/reports': ['admin', 'procurement_manager', 'store_manager', 'management'],
  '/admin': ['admin'],
};

export function canAccess(role, path) {
  const allowed = ROUTE_ROLES[path];
  return !allowed || allowed.includes(role);
}
