import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, memo, useMemo } from 'react';
import {
  ArrowDownToolbarItem,
  ArrowLeftToolbarItem,
  ArrowRightToolbarItem,
  ArrowToolbarItem,
  ArrowUpToolbarItem,
  AssetToolbarItem,
  CheckBoxToolbarItem,
  CloudToolbarItem,
  DefaultActionsMenu,
  DefaultActionsMenuContent,
  DefaultMainMenu,
  DefaultMainMenuContent,
  DefaultZoomMenu,
  DiamondToolbarItem,
  DrawToolbarItem,
  EllipseToolbarItem,
  EraserToolbarItem,
  FrameToolbarItem,
  HandToolbarItem,
  HeartToolbarItem,
  HexagonToolbarItem,
  HighlightToolbarItem,
  LaserToolbarItem,
  LineToolbarItem,
  MobileStylePanel,
  NoteToolbarItem,
  OvalToolbarItem,
  OverflowingToolbar,
  PORTRAIT_BREAKPOINT,
  RectangleToolbarItem,
  RhombusToolbarItem,
  SelectToolbarItem,
  StarToolbarItem,
  TextToolbarItem,
  Tldraw,
  TldrawUiOrientationProvider,
  TldrawUiMenuActionItem,
  TldrawUiMenuContextProvider,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  TldrawUiMenuSubmenu,
  TldrawUiToolbar,
  ToggleToolLockedButton,
  TriangleToolbarItem,
  XBoxToolbarItem,
  getSnapshot,
  loadSnapshot,
  useBreakpoint,
  useCanRedo,
  useCanUndo,
  useEditor,
  usePassThroughWheelEvents,
  useReadonly,
  useTldrawUiComponents,
  useTranslation,
  useUnlockedSelectedShapesCount,
  useValue,
} from 'tldraw';
import 'tldraw/tldraw.css';
import type { DrawingCanvasRef, DrawingData } from '../types/canvas';

function deleteSelectionOrLatestStroke(editor: any) {
  if (editor.getIsReadonly()) return;

  const selectedShapeIds = editor.getSelectedShapeIds();
  if (selectedShapeIds.length > 0) {
    editor.markHistoryStoppingPoint('delete');
    editor.deleteShapes(selectedShapeIds);
    return;
  }

  if (!editor.isIn('draw')) return;

  // In draw mode, make trash remove the latest stroke when nothing is selected.
  const pageShapeIds = Array.from(editor.getCurrentPageShapeIds().values());
  if (pageShapeIds.length === 0) return;
  const lastShapeId = pageShapeIds[pageShapeIds.length - 1];
  editor.markHistoryStoppingPoint('delete-latest-drawing');
  editor.deleteShapes([lastShapeId]);
}

function clearCanvasEditor(editor: any) {
  const pages = editor.getPages();
  if (pages.length === 0) return;

  const [firstPage, ...additionalPages] = pages;
  if (!firstPage) return;

  editor.setCurrentPage(firstPage.id);

  for (const page of additionalPages) {
    editor.deletePage(page.id);
  }

  const currentShapeIds = Array.from(editor.getCurrentPageShapeIds().values());
  if (currentShapeIds.length > 0) {
    editor.deleteShapes(currentShapeIds);
  }
}

function serializeDrawingData(drawingData: DrawingData | null) {
  return drawingData ? JSON.stringify(drawingData) : null;
}

interface DrawingCanvasProps {
  drawingData: DrawingData | null;
  onDrawingDataChange: (data: DrawingData | null) => void;
}

function DrawingQuickActionsContent() {
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  return (
    <>
      <TldrawUiMenuActionItem actionId="undo" disabled={!canUndo} />
      <TldrawUiMenuActionItem actionId="redo" disabled={!canRedo} />
    </>
  );
}

const DrawingQuickActions = memo(function DrawingQuickActions({
  children,
}: {
  children?: React.ReactNode
}) {
  const content = children ?? <DrawingQuickActionsContent />;
  return (
    <TldrawUiMenuContextProvider type="small-icons" sourceId="quick-actions">
      {content}
    </TldrawUiMenuContextProvider>
  );
});

function DrawingActionsMenuContent() {
  const editor = useEditor();
  const hasUnlockedSelection = Boolean(useUnlockedSelectedShapesCount(1));
  const canDelete = !editor.getIsReadonly() && editor.getCurrentPageShapeIds().size > 0;

  const handleDelete = () => {
    deleteSelectionOrLatestStroke(editor);
  };

  return (
    <>
      <TldrawUiMenuActionItem actionId="delete" disabled={!canDelete} onSelect={handleDelete} />
      <TldrawUiMenuActionItem actionId="duplicate" disabled={!hasUnlockedSelection} />
      <DefaultActionsMenuContent />
    </>
  );
}

const DrawingActionsMenu = memo(function DrawingActionsMenu({
  children,
}: {
  children?: React.ReactNode
}) {
  const content = children ?? <DrawingActionsMenuContent />;
  return <DefaultActionsMenu>{content}</DefaultActionsMenu>;
});

function DrawingPagesSubmenu() {
  const editor = useEditor();
  const pages = useValue('pages', () => editor.getPages(), [editor]);
  const currentPage = useValue('current page', () => editor.getCurrentPage(), [editor]);
  const canCreatePage = pages.length < editor.options.maxPages;

  return (
    <TldrawUiMenuSubmenu
      id="drawing-pages"
      label={`Pages (${currentPage.name})`}
      size="small"
    >
      <TldrawUiMenuGroup id="drawing-pages-list">
        {pages.map((page) => {
          const isCurrent = page.id === currentPage.id;
          const label = isCurrent ? `(current) ${page.name}` : page.name;

          return (
            <TldrawUiMenuItem
              id={`drawing-page-${page.id}`}
              key={page.id}
              label={label}
              disabled={isCurrent}
              onSelect={() => {
                editor.setCurrentPage(page.id);
              }}
            />
          );
        })}
      </TldrawUiMenuGroup>
      <TldrawUiMenuGroup id="drawing-pages-actions">
        <TldrawUiMenuActionItem actionId="new-page" disabled={!canCreatePage} />
      </TldrawUiMenuGroup>
    </TldrawUiMenuSubmenu>
  );
}

function DrawingMainMenuContent() {
  return (
    <>
      <TldrawUiMenuGroup id="drawing-pages-group">
        <DrawingPagesSubmenu />
      </TldrawUiMenuGroup>
      <DefaultMainMenuContent />
    </>
  );
}

const DrawingMainMenu = memo(function DrawingMainMenu({
  children,
}: {
  children?: React.ReactNode
}) {
  const content = children ?? <DrawingMainMenuContent />;
  return <DefaultMainMenu>{content}</DefaultMainMenu>;
});

const DrawingPenSettingsToolbarItem = memo(function DrawingPenSettingsToolbarItem() {
  const editor = useEditor();
  const breakpoint = useBreakpoint();
  const activeToolId = useValue('current tool id', () => editor.getCurrentToolId(), [editor]);

  if (breakpoint >= PORTRAIT_BREAKPOINT.TABLET_SM || activeToolId !== 'draw') {
    return null;
  }

  return <MobileStylePanel />;
});

const DrawingToolbarContent = memo(function DrawingToolbarContent() {
  return (
    <>
      <DrawToolbarItem />
      <DrawingPenSettingsToolbarItem />
      <SelectToolbarItem />
      <HandToolbarItem />
      <EraserToolbarItem />
      <ArrowToolbarItem />
      <TextToolbarItem />
      <NoteToolbarItem />
      <AssetToolbarItem />
      <RectangleToolbarItem />
      <EllipseToolbarItem />
      <TriangleToolbarItem />
      <DiamondToolbarItem />
      <HexagonToolbarItem />
      <OvalToolbarItem />
      <RhombusToolbarItem />
      <StarToolbarItem />
      <CloudToolbarItem />
      <HeartToolbarItem />
      <XBoxToolbarItem />
      <CheckBoxToolbarItem />
      <ArrowLeftToolbarItem />
      <ArrowUpToolbarItem />
      <ArrowDownToolbarItem />
      <ArrowRightToolbarItem />
      <LineToolbarItem />
      <HighlightToolbarItem />
      <LaserToolbarItem />
      <FrameToolbarItem />
    </>
  );
});

const DrawingToolbar = memo(function DrawingToolbar() {
  const editor = useEditor();
  const msg = useTranslation();
  const breakpoint = useBreakpoint();
  const isReadonlyMode = useReadonly();
  const activeToolId = useValue('current tool id', () => editor.getCurrentToolId(), [editor]);
  const ref = useRef<HTMLDivElement>(null);
  usePassThroughWheelEvents(ref);
  const { ActionsMenu, QuickActions } = useTldrawUiComponents();

  const showQuickActions = editor.options.actionShortcutsLocation === 'menu'
    ? false
    : editor.options.actionShortcutsLocation === 'toolbar'
      ? true
      : breakpoint < PORTRAIT_BREAKPOINT.TABLET;

  return (
    <TldrawUiOrientationProvider orientation="horizontal" tooltipSide="top">
      <div ref={ref} className="tlui-main-toolbar tlui-main-toolbar--horizontal">
        <div className="tlui-main-toolbar__inner">
          <div className="tlui-main-toolbar__left">
            {!isReadonlyMode && (
              <div className="tlui-main-toolbar__extras">
                {showQuickActions && (
                  <TldrawUiToolbar
                    orientation="horizontal"
                    className="tlui-main-toolbar__extras__controls"
                    label={msg('actions-menu.title')}
                  >
                    {QuickActions && <QuickActions />}
                    {ActionsMenu && <ActionsMenu />}
                  </TldrawUiToolbar>
                )}
                <ToggleToolLockedButton activeToolId={activeToolId} />
              </div>
            )}
            <OverflowingToolbar
              orientation="horizontal"
              sizingParentClassName="tlui-main-toolbar"
              minItems={1}
              minSizePx={160}
              maxItems={4}
              maxSizePx={250}
            >
              <DrawingToolbarContent />
            </OverflowingToolbar>
          </div>
        </div>
      </div>
    </TldrawUiOrientationProvider>
  );
});

const DrawingMenuPanel = memo(function DrawingMenuPanel() {
  const { MainMenu } = useTldrawUiComponents();

  if (!MainMenu) return null;

  return (
    <nav className="tlui-menu-zone drawing-main-menu-island">
      <div className="tlui-row">
        <MainMenu />
      </div>
    </nav>
  );
});

const DrawingNavigationPanel = memo(function DrawingNavigationPanel() {
  const msg = useTranslation();

  return (
    <div className="tlui-navigation-panel drawing-zoom-island">
      <TldrawUiToolbar orientation="horizontal" label={msg('navigation-zone.title')}>
        <DefaultZoomMenu />
      </TldrawUiToolbar>
    </div>
  );
});

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(function DrawingCanvas(
  { drawingData, onDrawingDataChange },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const isApplyingExternalDrawingRef = useRef(false);
  const lastSerializedDrawingRef = useRef<string | null>(null);
  const components = useMemo(() => ({
    QuickActions: DrawingQuickActions,
    ActionsMenu: DrawingActionsMenu,
    MainMenu: DrawingMainMenu,
    PageMenu: null,
    MenuPanel: DrawingMenuPanel,
    NavigationPanel: DrawingNavigationPanel,
    Toolbar: DrawingToolbar,
  }), []);
  const options = useMemo(() => ({
    actionShortcutsLocation: 'toolbar' as const,
  }), []);

  const applyDrawingData = useCallback((editor: any, nextDrawingData: DrawingData | null) => {
    const serializedNextDrawing = serializeDrawingData(nextDrawingData);
    const serializedCurrentDrawing = serializeDrawingData(getSnapshot(editor.store));

    if (serializedNextDrawing === serializedCurrentDrawing) {
      lastSerializedDrawingRef.current = serializedNextDrawing;
      return;
    }

    isApplyingExternalDrawingRef.current = true;

    try {
      if (nextDrawingData) {
        loadSnapshot(editor.store, nextDrawingData);
      } else {
        clearCanvasEditor(editor);
      }

      editor.setCurrentTool('draw');
      lastSerializedDrawingRef.current = serializedNextDrawing;
    } catch (error) {
      console.warn('Could not apply drawing data:', error);
    } finally {
      isApplyingExternalDrawingRef.current = false;
    }
  }, []);

  // Expose the captureImage method via ref
  useImperativeHandle(ref, () => ({
    captureImage: async () => {
      if (!editorRef.current) {
        console.error('No editor instance available for capture');
        return null;
      }

      try {
        console.log('Capturing drawing using tldraw native export...');

        // Get all shape IDs from the current page
        const shapeIds = editorRef.current.getCurrentPageShapeIds();

        if (shapeIds.size === 0) {
          console.warn('No shapes on canvas to capture');
          return null;
        }

        // Use tldraw's built-in toImage method
        const { blob } = await editorRef.current.toImage([...shapeIds], {
          format: 'png',
          background: true,
          scale: 2, // Higher quality
        });

        if (!blob) {
          console.error('Failed to generate image blob');
          return null;
        }

        // Convert blob to data URL
        return new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            console.log('Drawing captured successfully using native export');
            resolve(dataUrl);
          };
          reader.onerror = () => {
            console.error('Failed to read blob as data URL');
            resolve(null);
          };
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('Failed to capture drawing:', error);
        return null;
      }
    },
  }));

  const handleMount = useCallback((editor: any) => {
    // Store the editor reference for capture
    editorRef.current = editor;

    applyDrawingData(editor, drawingData);

    // Subscribe to changes using the history listener
    const unsubscribe = editor.store.listen(() => {
      if (isApplyingExternalDrawingRef.current) {
        return;
      }

      // Save the store snapshot whenever there's a change
      try {
        const snapshot = getSnapshot(editor.store);
        const serializedSnapshot = serializeDrawingData(snapshot);

        if (serializedSnapshot === lastSerializedDrawingRef.current) {
          return;
        }

        lastSerializedDrawingRef.current = serializedSnapshot;
        onDrawingDataChange(snapshot);
      } catch (e) {
        console.error('Failed to get snapshot:', e);
      }
    });

    // Return cleanup function
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [applyDrawingData, drawingData, onDrawingDataChange]);

  useEffect(() => {
    if (!editorRef.current) return;

    applyDrawingData(editorRef.current, drawingData);
  }, [applyDrawingData, drawingData]);

  return (
    <div ref={containerRef} className="drawing-canvas-root h-full w-full">
      <Tldraw
        onMount={handleMount}
        inferDarkMode
        components={components}
        options={options}
      />
    </div>
  );
});
