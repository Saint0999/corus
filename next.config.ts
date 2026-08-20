import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next 16 ships `qualities: [75]` and coerces any other `quality` prop to
    // the nearest allowed value, so a quality has to be declared here before a
    // component can ask for it. 90 is for the anatomy cutouts: they are a
    // smooth grey slab with a hairline chamfer around the edge, and 75 puts
    // ringing on exactly that edge.
    qualities: [75, 90],
  },
};

export default nextConfig;
