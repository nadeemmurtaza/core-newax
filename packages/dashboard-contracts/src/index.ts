export { DASHBOARD_CONTRACT_VERSION, isContractCompatible } from './version';

export type { PermissionCode } from './types/permissions';
export { isValidPermissionCode } from './types/permissions';

export type {
  ServiceId,
  ServiceLifecycleState,
  ServiceRegistration,
  ServiceNavigationItem,
} from './types/service';
export {
  SERVICE_LIFECYCLE_STATES,
  isServiceLifecycleState,
  isValidServiceId,
} from './types/service';

export type { WidgetId, WidgetSize, WidgetDefinition, WidgetDataAdapterRef } from './types/widget';
export { WIDGET_SIZES, isValidWidgetId, isWidgetSize } from './types/widget';

export type {
  PlacedWidget,
  LayoutScope,
  DashboardLayout,
  ResolvedDashboardLayout,
} from './types/layout';
export { LAYOUT_SCHEMA_VERSION } from './types/layout';

export type { WidgetRenderState } from './types/states';
export { isWidgetRenderState } from './types/states';

export type { LayoutValidationResult } from './validation/layout-validation';
export { validateDashboardLayout } from './validation/layout-validation';
