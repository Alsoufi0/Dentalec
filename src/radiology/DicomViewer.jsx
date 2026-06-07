import React, { useEffect, useRef, useState } from 'react';
import { init as coreInit, RenderingEngine, Enums } from '@cornerstonejs/core';
import { init as dicomInit } from '@cornerstonejs/dicom-image-loader';
import {
  init as toolsInit, addTool, ToolGroupManager,
  PanTool, ZoomTool, WindowLevelTool, LengthTool, AngleTool, Enums as ToolEnums
} from '@cornerstonejs/tools';

// Cornerstone3D DICOM viewer (lazy-loaded; only mounts for modality "dicom").
//
// Cornerstone3D setup, for future reference:
//   1. core.init()   -> boots the rendering engine + web worker manager
//   2. tools.init()  -> boots the tools framework
//   3. dicom.init()  -> registers the wadouri/wadors image loaders + WASM codecs
//   4. addTool(Tool) -> register each tool globally (once)
//   5. RenderingEngine + enableElement -> create a STACK viewport bound to a <div>
//   6. ToolGroupManager -> bind tools to the viewport and assign mouse buttons
//   7. viewport.setStack(['wadouri:<url>']) -> load + render the image
// Mouse map: left = active tool (window/level by default), middle = pan,
// right = zoom. Real DICOM windowing (VOI LUT) is handled natively here, unlike
// the CSS-filter approximation used for plain images.

const ENGINE_ID = 'rad-engine';
const VIEWPORT_ID = 'rad-viewport';
const TOOLGROUP_ID = 'rad-toolgroup';

let initPromise = null;
function ensureCornerstone() {
  if (!initPromise) {
    initPromise = (async () => {
      await coreInit();
      await toolsInit();
      dicomInit();
      [PanTool, ZoomTool, WindowLevelTool, LengthTool, AngleTool].forEach((Tool) => {
        try { addTool(Tool); } catch { /* already registered */ }
      });
    })();
  }
  return initPromise;
}

export default function DicomViewer({ src, invert, tool }) {
  const elRef = useRef(null);
  const vpRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let alive = true;
    let engine;
    (async () => {
      try {
        await ensureCornerstone();
        if (!alive || !elRef.current) return;

        engine = new RenderingEngine(ENGINE_ID);
        engine.enableElement({
          viewportId: VIEWPORT_ID,
          type: Enums.ViewportType.STACK,
          element: elRef.current
        });
        const viewport = engine.getViewport(VIEWPORT_ID);
        vpRef.current = viewport;

        let group = ToolGroupManager.getToolGroup(TOOLGROUP_ID);
        if (!group) {
          group = ToolGroupManager.createToolGroup(TOOLGROUP_ID);
          [PanTool, ZoomTool, WindowLevelTool, LengthTool, AngleTool].forEach((Tool) => group.addTool(Tool.toolName));
        }
        group.addViewport(VIEWPORT_ID, ENGINE_ID);
        const { MouseBindings } = ToolEnums;
        group.setToolActive(WindowLevelTool.toolName, { bindings: [{ mouseButton: MouseBindings.Primary }] });
        group.setToolActive(PanTool.toolName, { bindings: [{ mouseButton: MouseBindings.Auxiliary }] });
        group.setToolActive(ZoomTool.toolName, { bindings: [{ mouseButton: MouseBindings.Secondary }] });

        const url = new URL(src, window.location.origin).href;
        await viewport.setStack([`wadouri:${url}`]);
        viewport.setProperties({ invert: !!invert });
        viewport.render();
        if (alive) setStatus('ready');
      } catch (err) {
        console.error('[DicomViewer]', err);
        if (alive) setStatus('error');
      }
    })();

    return () => {
      alive = false;
      try { ToolGroupManager.destroyToolGroup(TOOLGROUP_ID); } catch { /* noop */ }
      try { engine && engine.destroy(); } catch { /* noop */ }
    };
  }, [src]);

  // Reflect the invert toggle.
  useEffect(() => {
    const vp = vpRef.current;
    if (vp && status === 'ready') {
      vp.setProperties({ invert: !!invert });
      vp.render();
    }
  }, [invert, status]);

  // Reflect the active measurement / interaction tool on the left mouse button.
  useEffect(() => {
    if (status !== 'ready') return;
    const group = ToolGroupManager.getToolGroup(TOOLGROUP_ID);
    if (!group) return;
    const { MouseBindings } = ToolEnums;
    const map = { pan: PanTool, length: LengthTool, angle: AngleTool };
    const primary = (map[tool] || WindowLevelTool).toolName;
    [WindowLevelTool, LengthTool, AngleTool, PanTool].forEach((Tool) => {
      try { group.setToolPassive(Tool.toolName); } catch { /* noop */ }
    });
    group.setToolActive(primary, { bindings: [{ mouseButton: MouseBindings.Primary }] });
    group.setToolActive(PanTool.toolName, { bindings: [{ mouseButton: MouseBindings.Auxiliary }] });
    group.setToolActive(ZoomTool.toolName, { bindings: [{ mouseButton: MouseBindings.Secondary }] });
  }, [tool, status]);

  return (
    <div className="rv-dicom">
      <div ref={elRef} className="rv-dicom-el" onContextMenu={(e) => e.preventDefault()} />
      {status === 'loading' && <div className="rv-loading"><span>Loading DICOM…</span></div>}
      {status === 'error' && (
        <div className="rv-loading error">
          <span>Could not load this DICOM file. Confirm the path points to a valid .dcm.</span>
        </div>
      )}
    </div>
  );
}
