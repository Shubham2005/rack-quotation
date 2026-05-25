import React from "react";

const RackSchematic = ({ item }) => {
  const { type, bays, shelvesPerRack, dimensions } = item;
  const isWall = type === "wall";
  const isPigeon = type === "pigeon";
  const isGondola = type === "gondola";

  const getDimVal = (dimName) => {
    let val = dimensions[dimName];
    if (val === "custom") {
      val =
        dimensions[
        `custom${dimName.charAt(0).toUpperCase() + dimName.slice(1)}`
        ];
    }
    return parseFloat(val) || 0;
  };

  const getBayVal = (bay) => {
    if (typeof bay === "object" && bay !== null && bay.isCustom) {
      return bay.val;
    }
    return parseFloat(bay);
  };

  const isCustomBay = (bay) => {
    return typeof bay === "object" && bay !== null && bay.isCustom;
  };

  const rawHeight = getDimVal("height");
  // If height is custom, the user entered inches. The schematic expects feet.
  const heightFt =
    dimensions.height === "custom" ? rawHeight / 12 : parseFloat(rawHeight);
  const heightInches =
    dimensions.height === "custom" ? rawHeight : parseFloat(rawHeight) * 12;

  // Breadth is always stored/entered in inches
  const breadthInches = getDimVal("breadth");

  const scale = 30;
  const paddingX = 40;
  const paddingY = 30;

  // --- Front View Math (Width) - For Standard Racks ---
  const totalWidthFt = bays.reduce((a, b) => {
    if (isCustomBay(b)) return a + b.val / 12;
    const val = parseFloat(b);
    if (isWall) {
      if (val === 35.5) return a + 3;
      if (val === 47.5) return a + 4;
      return a + val / 12;
    }
    return a + val;
  }, 0);
  const frontSvgWidth = totalWidthFt * scale + paddingX * 2;
  const svgHeight = heightFt * scale + paddingY * 2;

  let currentX = paddingX;
  const frontUprights = [currentX];
  const bayCenters = [];

  bays.forEach((bay) => {
    let bayFt;
    let label;
    if (isCustomBay(bay)) {
      bayFt = bay.val / 12;
      label = `${bay.val}"`;
    } else {
      const val = parseFloat(bay);
      if (isWall) {
        if (val === 35.5) {
          bayFt = 3;
          label = "3 '";
        } else if (val === 47.5) {
          bayFt = 4;
          label = "4 '";
        } else {
          bayFt = val / 12;
          label = `${val}"`;
        }
      } else {
        bayFt = val;
        label = `${val}'`;
      }
    }
    const bayPixels = bayFt * scale;
    bayCenters.push({
      x: currentX + bayPixels / 2,
      label,
    });
    currentX += bayPixels;
    frontUprights.push(currentX);
  });

  // --- Side View Math (Depth) - For Standard Racks ---
  const depthFt = breadthInches / 12;
  const sideSvgWidth = depthFt * scale + paddingX * 2;

  // --- Shelves & Ground Clearance Math - For Standard Racks ---
  const shelves = [];
  const topShelfY = paddingY;
  let bottomShelfY = paddingY + heightFt * scale;

  if (isPigeon) {
    bottomShelfY -= (3 / 12) * scale;
  }

  const shelfSpacing =
    (bottomShelfY - topShelfY) / (shelvesPerRack > 1 ? shelvesPerRack - 1 : 1);
  const shelfClearanceInches = ((shelfSpacing / scale) * 12).toFixed(1);

  for (let i = 0; i < shelvesPerRack; i++) {
    shelves.push(topShelfY + i * shelfSpacing);
  }

  // --- Pigeon Hole Individual Box Math ---
  const getBoxWidthInches = () => {
    const totalLenIn = totalWidthFt * 12;
    if (
      dimensions.useCustomColumns &&
      Array.isArray(dimensions.customColumns)
    ) {
      const uniqueCols = Array.from(
        new Set(
          dimensions.customColumns.map((c) =>
            c === "" ? 3 : Math.max(1, parseInt(c) || 3),
          ),
        ),
      );
      if (uniqueCols.length === 1) {
        return `${(totalLenIn / uniqueCols[0]).toFixed(1)}`;
      }
      const sortedWidths = uniqueCols
        .map((c) => totalLenIn / Math.max(1, c))
        .sort((a, b) => a - b);
      return `${sortedWidths[0].toFixed(1)} to ${sortedWidths[sortedWidths.length - 1].toFixed(1)}`;
    }
    const finalCols =
      dimensions.columns === ""
        ? 3
        : Math.max(1, parseInt(dimensions.columns) || 3);
    return `${(totalLenIn / finalCols).toFixed(1)}`;
  };
  const boxWidthInches = getBoxWidthInches();
  const boxHeightInches = (
    (heightFt * 12 - 3) /
    Math.max(1, shelvesPerRack - 1)
  ).toFixed(1);
  const boxDepthInches = breadthInches;

  // --- GONDOLA SPECIFIC MATH ---
  const getBayInches = (b) => {
    if (isCustomBay(b)) return b.val;
    return parseFloat(b) * 12;
  };
  const gondolaTotalWidthInches = isGondola
    ? bays.reduce((a, b) => a + getBayInches(b), 0)
    : 0;
  const gWidth = gondolaTotalWidthInches;
  const gHeight = heightFt * 12;
  const gDepth = breadthInches;
  const baseDepth = gDepth + 8; // Increases Base Deck depth by 2 inches for retail stagger
  const gShelves = parseInt(shelvesPerRack) || 4; // Number of ADJUSTABLE shelves (excludes base)
  const isDouble = dimensions.isDoubleSided;

  // Pre-compute upright X positions for all gondola bays
  const gondolaUprights = isGondola
    ? (() => {
      const xs = [];
      let cx = 0;
      xs.push(cx);
      bays.forEach((b) => {
        cx += getBayInches(b);
        xs.push(cx);
      });
      return xs;
    })()
    : [];

  const uprightW = 2;
  const baseDeckH = 6;
  const shelfThickness = 1.25;
  const usableH = gHeight - baseDeckH;
  // Divides space equally so top shelf sits nicely at the top of the uprights
  const gShelfSpacing = usableH / Math.max(1, gShelves);

  // Side view boundaries to prevent SVG clipping
  const centerUprightX = 0;
  const sideMinX = isDouble ? -baseDepth - 8 : -8;
  const sideMaxX = uprightW + baseDepth + 20;
  const sideViewWidth = sideMaxX - sideMinX;

  // --- UI Theming ---
  const title = isGondola
    ? "Gondola Rack"
    : isPigeon
      ? "Pigeon Hole Rack"
      : isWall
        ? "Wall Mounted Rack"
        : "Slotted Angle Rack";

  const titleColor = isGondola
    ? "text-teal-400"
    : isPigeon
      ? "text-orange-400"
      : isWall
        ? "text-indigo-400"
        : "text-blue-400";

  const themeColor = isGondola ? "#14B8A6" : isPigeon ? "#FB923C" : "#60A5FA";

  const uprightColor = isWall
    ? "#ffffff"
    : isPigeon
      ? "#F97316"
      : isGondola
        ? "#9CA3AF"
        : "#9CA3AF";

  return (
    <div className="flex flex-col items-center bg-gray-800/50 p-4 rounded-lg border border-gray-700 w-full">
      <p
        className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-4 ${titleColor}`}
      >
        {title}
      </p>

      {/* ========================================= */}
      {/*             GONDOLA SCHEMATIC             */}
      {/* ========================================= */}
      {isGondola ? (
        <div className="flex flex-row items-center justify-center gap-2 sm:gap-6 w-full">
          {/* GONDOLA FRONT ELEVATION - multi-bay */}
          <div className="flex flex-col items-center w-[65%] border-r border-gray-700 pr-2 sm:pr-4">
            <span className="text-[9px] sm:text-[10px] text-gray-500 mb-2 font-mono text-center">
              FRONT VIEW
            </span>
            <svg
              viewBox={`-25 -10 ${gWidth + 45} ${gHeight + 35}`}
              className="w-full max-h-40 object-contain drop-shadow-md"
            >
              <defs>
                <pattern
                  id="gridG"
                  width="4"
                  height="4"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 4 0 L 0 0 0 4"
                    fill="none"
                    stroke="#374151"
                    strokeWidth="0.5"
                    opacity="0.5"
                  />
                </pattern>
              </defs>
              <rect
                x="-25"
                y="-10"
                width={gWidth + 45}
                height={gHeight + 35}
                fill="url(#gridG)"
              />

              {/* Height label */}
              <line
                x1="-5"
                y1="0"
                x2="-5"
                y2={gHeight}
                stroke="#9CA3AF"
                strokeWidth="0.5"
              />
              <line
                x1="-7"
                y1="0"
                x2="-3"
                y2="0"
                stroke="#9CA3AF"
                strokeWidth="0.5"
              />
              <line
                x1="-7"
                y1={gHeight}
                x2="-3"
                y2={gHeight}
                stroke="#9CA3AF"
                strokeWidth="0.5"
              />
              <text
                x="-9"
                y={gHeight / 2}
                fill="#9CA3AF"
                fontSize="5"
                fontWeight="bold"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {heightInches}"
              </text>

              {/* Per-bay: cladding + shelves + base deck */}
              {bays.map((bay, bi) => {
                const bx = gondolaUprights[bi];
                const bw = getBayInches(bay);
                const bayLabel = isCustomBay(bay) ? `${bay.val}"` : `${bay} '`;
                return (
                  <g key={`gbay-${bi}`}>
                    {/* Back Cladding */}
                    <rect
                      x={bx + uprightW}
                      y="0"
                      width={bw - uprightW}
                      height={gHeight - baseDeckH}
                      fill="#374151"
                      stroke="#4B5563"
                      strokeWidth="0.3"
                    />
                    {/* Base Deck */}
                    <rect
                      x={bx}
                      y={gHeight - baseDeckH}
                      width={bw}
                      height={baseDeckH}
                      fill="#0F766E"
                      stroke="#0D9488"
                      strokeWidth="0.3"
                    />
                    {/* Shelves */}
                    {Array.from({ length: gShelves }).map((_, i) => {
                      const shelfY =
                        gHeight - baseDeckH - gShelfSpacing * (i + 1);
                      return (
                        <g key={`gbay${bi}-shelf-${i}`}>
                          <rect
                            x={bx + uprightW}
                            y={shelfY}
                            width={bw - uprightW}
                            height={shelfThickness}
                            fill="#14B8A6"
                            stroke="#0D9488"
                            strokeWidth="0.3"
                          />
                          {dimensions.hasStopper && (
                            <rect
                              x={bx + uprightW}
                              y={shelfY - 3}
                              width={bw - uprightW}
                              height="3"
                              fill="#5EEAD4"
                              stroke="#0D9488"
                              strokeWidth="0.3"
                              opacity="0.3"
                            />
                          )}
                        </g>
                      );
                    })}
                    {/* Bay width label */}
                    <line
                      x1={bx}
                      y1={gHeight + 10}
                      x2={bx + bw}
                      y2={gHeight + 10}
                      stroke="#9CA3AF"
                      strokeWidth="0.5"
                    />
                    <text
                      x={bx + bw / 2}
                      y={gHeight + 18}
                      fill="#9CA3AF"
                      fontSize="5"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {bayLabel}
                    </text>
                  </g>
                );
              })}

              {/* All uprights (shared stands) */}
              {gondolaUprights.map((ux, ui) => (
                <rect
                  key={`gupright-${ui}`}
                  x={ux}
                  y="0"
                  width={uprightW}
                  height={gHeight}
                  fill="#6B7280"
                  stroke="#4B5563"
                  strokeWidth="0.5"
                />
              ))}
            </svg>
          </div>

          {/* GONDOLA SIDE ELEVATION - 35% Width */}
          <div className="flex flex-col items-center w-[35%] pl-1 sm:pl-4">
            <span className="text-[9px] sm:text-[10px] text-gray-500 mb-2 font-mono text-center">
              SIDE VIEW
            </span>
            <svg
              viewBox={`${sideMinX} -10 ${sideViewWidth + (dimensions.useCustomBreadths ? 18 : 0)} ${gHeight + 35}`}
              className="w-full max-h-40 object-contain drop-shadow-md"
            >
              {/* Bottom Depth Label - shown only when NOT using mixed depths */}
              {!dimensions.useCustomBreadths && (
                <>
                  <line
                    x1={0}
                    y1={gHeight + 10}
                    x2={uprightW + gDepth}
                    y2={gHeight + 10}
                    stroke="#9CA3AF"
                    strokeWidth="0.5"
                  />
                  <line
                    x1={0}
                    y1={gHeight + 12}
                    x2={0}
                    y2={gHeight + 8}
                    stroke="#9CA3AF"
                    strokeWidth="0.5"
                  />
                  <line
                    x1={uprightW + gDepth}
                    y1={gHeight + 12}
                    x2={uprightW + gDepth}
                    y2={gHeight + 8}
                    stroke="#9CA3AF"
                    strokeWidth="0.5"
                  />
                  <text
                    x={gDepth / 2}
                    y={gHeight + 18}
                    fill="#9CA3AF"
                    fontSize="5"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {`${gDepth}"`}
                  </text>
                </>
              )}

              {/* Central/Back Upright */}
              <rect
                x={centerUprightX}
                y="0"
                width={uprightW}
                height={gHeight}
                fill="#6B7280"
                stroke="#4B5563"
                strokeWidth="0.5"
              />

              {/* Draw Right Side (Standard) */}
              <g>
                {/* Base Deck Right (Extended by 2 inches) */}
                <polygon
                  points={`${centerUprightX + uprightW},${gHeight} ${centerUprightX + uprightW + baseDepth},${gHeight} ${centerUprightX + uprightW + baseDepth},${gHeight - baseDeckH} ${centerUprightX + uprightW},${gHeight - baseDeckH}`}
                  fill="#0F766E"
                  stroke="#0D9488"
                  strokeWidth="0.5"
                />

                {/* Shelves Right */}
                {Array.from({ length: gShelves }).map((_, i) => {
                  const shelfY = gHeight - baseDeckH - gShelfSpacing * (i + 1);
                  let layerDepth = gDepth;
                  if (
                    dimensions.useCustomBreadths &&
                    Array.isArray(dimensions.customBreadths)
                  ) {
                    const rawL = dimensions.customBreadths[i];
                    if (rawL !== undefined) {
                      if (rawL === "custom") {
                        const customVal =
                          dimensions.customBreadthsVals?.[i] ||
                          dimensions.customBreadth ||
                          "10";
                        layerDepth = parseFloat(customVal) || 0;
                      } else {
                        layerDepth = parseFloat(rawL) || 0;
                      }
                    }
                  }

                  return (
                    <g key={`rshelf-${i}`}>
                      <polygon
                        points={`${centerUprightX + uprightW},${shelfY} ${centerUprightX + uprightW + layerDepth},${shelfY} ${centerUprightX + uprightW + layerDepth},${shelfY + shelfThickness} ${centerUprightX + uprightW},${shelfY + shelfThickness}`}
                        fill="#14B8A6"
                        stroke="#0D9488"
                        strokeWidth="0.5"
                      />
                      {dimensions.hasStopper && (
                        <rect
                          x={centerUprightX + uprightW + layerDepth - 0.5}
                          y={shelfY - 3}
                          width="0.5"
                          height="3"
                          fill="#5EEAD4"
                        />
                      )}
                      {/* Per-shelf depth label when mixed depths are used */}
                      {dimensions.useCustomBreadths && (
                        <>
                          <line
                            x1={centerUprightX + uprightW + layerDepth + 1}
                            y1={shelfY + shelfThickness / 2}
                            x2={centerUprightX + uprightW + layerDepth + 6}
                            y2={shelfY + shelfThickness / 2}
                            stroke="#6EE7B7"
                            strokeWidth="0.5"
                            strokeDasharray="1 1"
                          />
                          <text
                            x={centerUprightX + uprightW + layerDepth + 7}
                            y={shelfY + shelfThickness / 2}
                            fill="#6EE7B7"
                            fontSize="4"
                            fontWeight="bold"
                            textAnchor="start"
                            dominantBaseline="middle"
                          >
                            {layerDepth}"
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Draw Left Side (If Double Sided) */}
              {isDouble && (
                <g>
                  {/* Base Deck Left (Extended by 2 inches) */}
                  <polygon
                    points={`${centerUprightX},${gHeight} ${centerUprightX - baseDepth},${gHeight} ${centerUprightX - baseDepth},${gHeight - baseDeckH} ${centerUprightX},${gHeight - baseDeckH}`}
                    fill="#0F766E"
                    stroke="#0D9488"
                    strokeWidth="0.5"
                  />

                  {/* Shelves Left */}
                  {Array.from({ length: gShelves }).map((_, i) => {
                    const shelfY =
                      gHeight - baseDeckH - gShelfSpacing * (i + 1);
                    let layerDepth = gDepth;
                    if (
                      dimensions.useCustomBreadths &&
                      Array.isArray(dimensions.customBreadths)
                    ) {
                      const rawL = dimensions.customBreadths[i];
                      if (rawL !== undefined) {
                        if (rawL === "custom") {
                          const customVal =
                            dimensions.customBreadthsVals?.[i] ||
                            dimensions.customBreadth ||
                            "10";
                          layerDepth = parseFloat(customVal) || 0;
                        } else {
                          layerDepth = parseFloat(rawL) || 0;
                        }
                      }
                    }

                    return (
                      <g key={`lshelf-${i}`}>
                        <polygon
                          points={`${centerUprightX},${shelfY} ${centerUprightX - layerDepth},${shelfY} ${centerUprightX - layerDepth},${shelfY + shelfThickness} ${centerUprightX},${shelfY + shelfThickness}`}
                          fill="#14B8A6"
                          stroke="#0D9488"
                          strokeWidth="0.5"
                        />
                        {dimensions.hasStopper && (
                          <rect
                            x={centerUprightX - layerDepth}
                            y={shelfY - 3}
                            width="0.5"
                            height="3"
                            fill="#5EEAD4"
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Clearance Label (Between 1st & 2nd Shelf) */}
              {gShelves > 1 && (
                <g>
                  <line
                    x1={uprightW + gDepth + 4}
                    y1={gHeight - baseDeckH - gShelfSpacing}
                    x2={uprightW + gDepth + 4}
                    y2={gHeight - baseDeckH - gShelfSpacing * 2}
                    stroke="#9CA3AF"
                    strokeWidth="0.5"
                    strokeDasharray="1 1"
                  />
                  <text
                    x={uprightW + gDepth + 6}
                    y={gHeight - baseDeckH - gShelfSpacing * 1.5}
                    fill="#9CA3AF"
                    fontSize="4.5"
                    fontWeight="bold"
                    textAnchor="start"
                    dominantBaseline="middle"
                  >
                    {gShelfSpacing.toFixed(1)}"
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>
      ) : (
        /* ========================================= */
        /* STANDARD RACKS (Slotted, Wall, Pigeon)    */
        /* ========================================= */
        <div className="flex flex-row items-center justify-center gap-2 sm:gap-6 w-full">
          {/* FRONT ELEVATION (WIDTH) - 65% Width */}
          <div className="flex flex-col items-center w-[65%] border-r border-gray-700 pr-2 sm:pr-4">
            <span className="text-[9px] sm:text-[10px] text-gray-500 mb-2 font-mono text-center">
              FRONT VIEW
            </span>
            <svg
              viewBox={`0 0 ${frontSvgWidth} ${svgHeight + 20}`}
              className="w-full max-h-40 object-contain drop-shadow-md"
            >
              {isPigeon && (
                <rect
                  x={paddingX}
                  y={topShelfY}
                  width={totalWidthFt * scale}
                  height={bottomShelfY - topShelfY}
                  fill="#431407"
                  opacity="0.3"
                />
              )}

              {shelves.map((y, idx) => (
                <g key={`f-shelf-${idx}`}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={currentX}
                    y2={y}
                    stroke={themeColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  {(isWall || (isPigeon && idx > 0)) &&
                    dimensions.hasStopper && (
                      <rect
                        x={paddingX}
                        y={y - (3 / 12) * scale}
                        width={currentX - paddingX}
                        height={(3 / 12) * scale}
                        fill={isPigeon ? "#FB923C" : "#818CF8"}
                        opacity="0.4"
                      />
                    )}
                </g>
              ))}

              {/* Vertical Dividers for Pigeon Hole Rack (Supports Custom Columns per Shelf) */}
              {isPigeon &&
                shelves.slice(0, -1).map((yTop, sIdx) => {
                  const yBottom = shelves[sIdx + 1];
                  const rawCols =
                    dimensions.useCustomColumns &&
                      Array.isArray(dimensions.customColumns) &&
                      dimensions.customColumns[sIdx] !== undefined
                      ? dimensions.customColumns[sIdx]
                      : dimensions.columns;
                  const cols =
                    rawCols === "" ? 3 : Math.max(1, parseInt(rawCols) || 3);

                  if (cols <= 1) return null;

                  const colWidthPixels = (totalWidthFt * scale) / cols;
                  const dividerLines = [];
                  for (let i = 1; i < cols; i++) {
                    dividerLines.push(paddingX + i * colWidthPixels);
                  }

                  return dividerLines.map((x, dIdx) => (
                    <line
                      key={`f-div-${sIdx}-${dIdx}`}
                      x1={x}
                      y1={yTop}
                      x2={x}
                      y2={yBottom}
                      stroke="#FB923C"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray="3 3"
                    />
                  ));
                })}

              {frontUprights.map((x, idx) => (
                <line
                  key={`f-upright-${idx}`}
                  x1={x}
                  y1={paddingY - 5}
                  x2={x}
                  y2={svgHeight - paddingY + 5}
                  stroke={uprightColor}
                  strokeWidth={isWall ? "4" : "6"}
                  strokeLinecap="round"
                />
              ))}

              {bayCenters.map((bay, idx) => (
                <text
                  key={`bay-label-${idx}`}
                  x={bay.x}
                  y={svgHeight - paddingY + 25}
                  fill="#9CA3AF"
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {bay.label}
                </text>
              ))}

              <text
                x={paddingX - 15}
                y={paddingY + (heightFt * scale) / 2}
                fill="#9CA3AF"
                fontSize="12"
                fontWeight="bold"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {heightInches}"
              </text>
              <line
                x1={paddingX - 8}
                y1={paddingY}
                x2={paddingX - 8}
                y2={svgHeight - paddingY}
                stroke="#4B5563"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            </svg>
          </div>

          {/* CONDITIONAL RIGHT PANEL (3D BOX FOR PIGEON, SIDE VIEW FOR OTHERS) */}
          {isPigeon ? (
            <div className="flex flex-col items-center w-[35%] pl-1 sm:pl-2">
              <span className="text-[9px] sm:text-[10px] text-gray-500 mb-2 font-mono text-center">
                BOX DIMENSIONS
              </span>
              <svg
                viewBox="-20 0 220 220"
                className="w-full max-h-40 object-contain drop-shadow-md"
              >
                {/* Top Face */}
                <polygon
                  points="50,80 90,50 160,50 120,80"
                  fill="#FDBA74"
                  stroke="#EA580C"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                {/* Right Face */}
                <polygon
                  points="120,80 160,50 160,140 120,170"
                  fill="#EA580C"
                  stroke="#C2410C"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                {/* Front Face */}
                <polygon
                  points="50,80 120,80 120,170 50,170"
                  fill="#FB923C"
                  stroke="#EA580C"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />

                {/* Width Label */}
                <line
                  x1="50"
                  y1="180"
                  x2="120"
                  y2="180"
                  stroke="#9CA3AF"
                  strokeWidth="1"
                />
                <line
                  x1="50"
                  y1="175"
                  x2="50"
                  y2="185"
                  stroke="#9CA3AF"
                  strokeWidth="1"
                />
                <line
                  x1="120"
                  y1="175"
                  x2="120"
                  y2="185"
                  stroke="#9CA3AF"
                  strokeWidth="1"
                />
                <text
                  x="85"
                  y="195"
                  fill="#D1D5DB"
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {boxWidthInches}" W
                </text>

                {/* Height Label */}
                <line
                  x1="40"
                  y1="80"
                  x2="40"
                  y2="170"
                  stroke="#9CA3AF"
                  strokeWidth="1"
                />
                <line
                  x1="35"
                  y1="80"
                  x2="45"
                  y2="80"
                  stroke="#9CA3AF"
                  strokeWidth="1"
                />
                <line
                  x1="35"
                  y1="170"
                  x2="45"
                  y2="170"
                  stroke="#9CA3AF"
                  strokeWidth="1"
                />
                <text
                  x="30"
                  y="125"
                  fill="#D1D5DB"
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {boxHeightInches}" H
                </text>

                {/* Depth Label */}
                <line
                  x1="130"
                  y1="175"
                  x2="170"
                  y2="145"
                  stroke="#9CA3AF"
                  strokeWidth="1"
                />
                <line
                  x1="127"
                  y1="171"
                  x2="133"
                  y2="179"
                  stroke="#9CA3AF"
                  strokeWidth="1"
                />
                <line
                  x1="167"
                  y1="141"
                  x2="173"
                  y2="149"
                  stroke="#9CA3AF"
                  strokeWidth="1"
                />
                <text
                  x="160"
                  y="175"
                  fill="#D1D5DB"
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="start"
                >
                  {boxDepthInches}" D
                </text>
              </svg>
            </div>
          ) : (
            <div className="flex flex-col items-center w-[35%] pl-1 sm:pl-2">
              <span className="text-[9px] sm:text-[10px] text-gray-500 mb-2 font-mono text-center">
                SIDE VIEW
              </span>
              <svg
                viewBox={`0 0 ${sideSvgWidth + (isWall && dimensions.useCustomBreadths ? 55 : 20)} ${svgHeight + 20}`}
                className="w-full max-h-40 object-contain drop-shadow-md"
              >
                {shelves.map((y, idx) => {
                  let layerBreadthInches = breadthInches;
                  if (
                    isWall &&
                    dimensions.useCustomBreadths &&
                    Array.isArray(dimensions.customBreadths)
                  ) {
                    const layerIdx = shelvesPerRack - 1 - idx;
                    const rawL = dimensions.customBreadths[layerIdx];
                    if (rawL !== undefined) {
                      if (rawL === "custom") {
                        const customVal =
                          dimensions.customBreadthsVals?.[layerIdx] ||
                          dimensions.customBreadth ||
                          "10";
                        layerBreadthInches = parseFloat(customVal) || 0;
                      } else {
                        layerBreadthInches = parseFloat(rawL) || 0;
                      }
                    }
                  }
                  const layerDepthFt = layerBreadthInches / 12;

                  return (
                    <g key={`s-shelf-${idx}`}>
                      <line
                        x1={paddingX}
                        y1={y}
                        x2={paddingX + layerDepthFt * scale}
                        y2={y}
                        stroke={themeColor}
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      {isWall && dimensions.hasStopper && (
                        <line
                          x1={paddingX + layerDepthFt * scale}
                          y1={y}
                          x2={paddingX + layerDepthFt * scale}
                          y2={y - (3 / 12) * scale}
                          stroke="#818CF8"
                          strokeWidth="6"
                          strokeLinecap="round"
                        />
                      )}
                      {/* Per-shelf depth label when mixed depths are used */}
                      {isWall && dimensions.useCustomBreadths && (
                        <>
                          <line
                            x1={paddingX + layerDepthFt * scale + 2}
                            y1={y}
                            x2={paddingX + layerDepthFt * scale + 10}
                            y2={y}
                            stroke="#A5B4FC"
                            strokeWidth="0.8"
                            strokeDasharray="2 2"
                          />
                          <text
                            x={paddingX + layerDepthFt * scale + 12}
                            y={y}
                            fill="#A5B4FC"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="start"
                            dominantBaseline="middle"
                          >
                            {layerBreadthInches}"
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}

                <line
                  x1={paddingX}
                  y1={paddingY - 5}
                  x2={paddingX}
                  y2={svgHeight - paddingY + 5}
                  stroke={uprightColor}
                  strokeWidth={isWall ? "4" : "6"}
                  strokeLinecap="round"
                />

                {!isWall && (
                  <line
                    x1={paddingX + depthFt * scale}
                    y1={paddingY - 5}
                    x2={paddingX + depthFt * scale}
                    y2={svgHeight - paddingY + 5}
                    stroke={uprightColor}
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                )}

                {/* Bottom depth label — hide for wall with mixed depths since labels are per-shelf */}
                {!(isWall && dimensions.useCustomBreadths) && (
                  <text
                    x={paddingX + (depthFt * scale) / 2}
                    y={svgHeight - paddingY + 25}
                    fill="#9CA3AF"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {`${breadthInches}"`}
                  </text>
                )}

                {shelvesPerRack > 1 && (
                  <g opacity="0.8">
                    <line
                      x1={paddingX + depthFt * scale + 12}
                      y1={topShelfY}
                      x2={paddingX + depthFt * scale + 12}
                      y2={topShelfY + shelfSpacing}
                      stroke="#9CA3AF"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={paddingX + depthFt * scale + 16}
                      y={topShelfY + shelfSpacing / 2}
                      fill="#9CA3AF"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="start"
                      dominantBaseline="middle"
                    >
                      {shelfClearanceInches}"
                    </text>
                  </g>
                )}
              </svg>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RackSchematic;
