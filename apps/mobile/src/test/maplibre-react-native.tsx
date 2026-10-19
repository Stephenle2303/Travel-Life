import { forwardRef, type ReactNode } from 'react';
import { View } from 'react-native';

// Native MapLibre is exercised on device. This lightweight test double keeps
// unrelated component suites from loading its platform-native module.
export const Map = View;
export const Layer = View;
export const Camera = forwardRef(function MockCamera(props: object, _ref) {
  return <View {...props} />;
});
export function GeoJSONSource({ children, ...props }: { children?: ReactNode }) {
  return <View {...props}>{children}</View>;
}
