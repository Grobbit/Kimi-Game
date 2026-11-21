"use client";

import {
  Bloom,
  EffectComposer,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

export default function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO
        intensity={1.9}
        aoRadius={1.6}
        distanceFalloff={1.1}
        halfRes
      />
      <Bloom
        mipmapBlur
        intensity={0.42}
        luminanceThreshold={0.82}
        luminanceSmoothing={0.25}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.16} darkness={0.55} eskil={false} />
      <SMAA />
    </EffectComposer>
  );
}
