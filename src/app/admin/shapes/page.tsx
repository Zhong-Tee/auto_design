import { getShapes } from "./actions";
import { ShapesPanel } from "./shapes-panel";

export default async function AdminShapesPage() {
  const shapes = await getShapes();
  return <ShapesPanel initialShapes={shapes ?? []} />;
}
