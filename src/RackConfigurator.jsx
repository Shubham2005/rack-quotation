import React, { useState, useMemo, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import {
  ShoppingCart,
  LayoutGrid,
  Ruler,
  Wrench,
  RefreshCcw,
  Plus,
  Minus,
  Trash2,
  PackagePlus,
  Share2,
  ListChecks,
  Undo2,
  Truck,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import {
  MOCK_PRICING,
  WALL_BRACKET_MAP,
  WALL_STOPPER_MAP,
} from "./constants/pricing";
import { calculateQuote } from "./utils/quoteEngine";
import RackSchematic from "./components/RackSchematic";

const MAX_RACKS = 100;
const MAX_SHELVES = 15;

const RackConfigurator = () => {
  // --- CORE STATE ---
  const [activeTab, setActiveTab] = useState("slotted"); // 'slotted' | 'wall'
  const [cart, setCart] = useState([]);
  const [expandedCartId, setExpandedCartId] = useState(null);
  const [customerPhone, setCustomerPhone] = useState("");

  // --- BUILDER STATE ---
  const [hoveredCell, setHoveredCell] = useState({ x: 0, y: 0 });
  const [selectedCell, setSelectedCell] = useState({ x: 0, y: 0 });
  const [buildMode, setBuildMode] = useState("standard");
  const [mixedBays, setMixedBays] = useState([]);
  const [mixedShelves, setMixedShelves] = useState(5);
  const [customItem, setCustomItem] = useState({ category: "plates", qty: 1 });

  // Slotted Dimensions
  const [slottedDims, setSlottedDims] = useState({
    length: "3",
    breadth: "12",
    height: "6",
    plateGauge: 22,
    angleGauge: 16,
    plateColor: "standard",
    angleColor: "standard",
  });

  // Wall Dimensions
  const [wallDims, setWallDims] = useState({
    length: "35.5",
    breadth: "9.25",
    height: "6",
    plateGauge: "22",
    hasStopper: false,
  });

  // Gondola Dimensions
  const [gondolaDims, setGondolaDims] = useState({
    length: "3", // 3ft or 4ft standalone
    height: "6", // 4, 5, 6, 7
    breadth: "12.25",
    shelves: 4,
    plateGauge: "22",
    hasStopper: false,
    isDoubleSided: false,
  });

  // Pigeon Dimensions
  const [pigeonDims, setPigeonDims] = useState({
    length: "3",
    breadth: "12",
    height: "6",
    rows: 4,
    columns: 3,
    plateGauge: 22,
    angleGauge: 16,
    hasStopper: true,
  });

  const [overrides, setOverrides] = useState({});
  const [isCapturing, setIsCapturing] = useState(false);

  // --- CHARGES STATE ---
  const [slottedFittingRate, setSlottedFittingRate] = useState(20);
  const [wallFittingRate, setWallFittingRate] = useState(100);
  const [pigeonFittingRate, setPigeonFittingRate] = useState(25);
  const [gondolaFittingCharge, setGondolaFittingCharge] = useState("");
  const [rickshawRent, setRickshawRent] = useState("");
  const [isFittingOpted, setIsFittingOpted] = useState(false);
  const [quotationNote, setQuotationNote] = useState("");
  const [applyMarkup, setApplyMarkup] = useState(false);

  const quoteRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Reset grid & scrolling when modes switch
  useEffect(() => {
    setSelectedCell({ x: 0, y: 0 });
    setMixedBays([]);
    setCustomItem({ category: "plates", qty: 1 });
    if (buildMode === "standard" && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [buildMode, activeTab]);

  const handleDimChange = (e, type) => {
    const { name, value, type: inputType, checked } = e.target;

    // FIX 1: Prevent parseInt from destroying the "22D" string
    const val =
      inputType === "checkbox"
        ? checked
        : name.includes("Gauge") && value !== "22D"
          ? parseInt(value)
          : value;

    if (type === "slotted") {
      setSlottedDims((prev) => ({ ...prev, [name]: val }));
    } else {
      // FIX 2: Safety reset. If shrinking breadth, remove Double Part gauge
      if (
        type === "wall" &&
        name === "breadth" &&
        wallDims.plateGauge === "22D"
      ) {
        const isDoubleAllowed = ["12.25", "14.25", "16.25"].includes(value);
        if (!isDoubleAllowed) {
          setWallDims((prev) => ({ ...prev, [name]: val, plateGauge: "22" }));
          return; // Exit early since we handled the state
        }
      }

      setWallDims((prev) => ({ ...prev, [name]: val }));
    }
  };

  const handleGridClick = (x, y) => setSelectedCell({ x, y });

  const handleStructureInputChange = (axis, value) => {
    const val = value === "" ? "" : parseInt(value);
    setSelectedCell((prev) => {
      let newX = axis === "x" ? val : prev.x;
      let newY = axis === "y" ? val : prev.y;
      if (newX > MAX_RACKS) newX = MAX_RACKS;
      if (newY > MAX_SHELVES) newY = MAX_SHELVES;
      return { x: newX || 0, y: newY || 0 };
    });
  };

  const handleAddToCart = () => {
    let newBays = [];
    let shelves = 0;
    const isSlotted = activeTab === "slotted";
    const currentLength = isSlotted ? slottedDims.length : wallDims.length;

    if (buildMode === "standard") {
      if (selectedCell.x === 0 || selectedCell.y === 0) return;
      newBays = Array(selectedCell.x).fill(
        isSlotted ? parseInt(currentLength) : parseFloat(currentLength),
      );
      shelves = selectedCell.y;
    } else {
      if (mixedBays.length === 0 || mixedShelves === 0) return;
      newBays = [...mixedBays];
      shelves = mixedShelves === "" ? 1 : mixedShelves;
    }
    const finalQty =
      customItem.qty === "" || isNaN(customItem.qty) || customItem.qty < 1
        ? 1
        : customItem.qty;
    const newItem = {
      id: Date.now(),
      type: activeTab,
      dimensions: isSlotted ? { ...slottedDims } : { ...wallDims },
      bays: newBays,
      shelvesPerRack: shelves,
      qty: 1,
    };

    setCart((prev) => [...prev, newItem]);
    setSelectedCell({ x: 0, y: 0 });
    setMixedBays([]);
    setOverrides({});
  };

  const handleAddCustomItem = () => {
    const isSlotted = activeTab === "slotted";
    const dims = isSlotted ? slottedDims : wallDims;
    let label = "";
    let price = 0;
    const category = customItem.category;

    if (isSlotted) {
      if (category === "plates") {
        let pPrice =
          MOCK_PRICING.slotted.plates[`${dims.length}-${dims.breadth}`]?.[
            dims.plateGauge
          ] || 0;
        let pLabel = `${dims.length}'x${dims.breadth}" Plate (${dims.plateGauge}G)`;

        if (dims.plateColor === "custom") {
          const surcharge =
            MOCK_PRICING.slotted.colorSurcharge.plates[
              `${dims.length}-${dims.breadth}`
            ] || 0;
          pPrice += surcharge;
          pLabel += ` - Custom Color (+₹${surcharge}/pc)`;
        }

        price = pPrice;
        label = pLabel;
      } else if (category === "angles") {
        let aPrice =
          MOCK_PRICING.slotted.angles[dims.height]?.[dims.angleGauge] || 0;
        let aLabel = `${dims.height}ft Angle (${dims.angleGauge}G)`;

        if (dims.angleColor === "custom") {
          const surcharge =
            MOCK_PRICING.slotted.colorSurcharge.angles[dims.height] || 0;
          aPrice += surcharge;
          aLabel += ` - Custom Color (+₹${surcharge}/pc)`;
        }

        price = aPrice;
        label = aLabel;
      } else if (category === "bolts") {
        label = "Nut/Bolts";
        price = quote.hardwarePrices.bolt;
      } else if (category === "corners") {
        label = "Corner Supports";
        price = quote.hardwarePrices.corner;
      } else if (category === "bushes") {
        label = "Rubber Bushes";
        price = quote.hardwarePrices.bush;
      }
    } else {
      if (category === "plates") {
        label = `${dims.length}"x${dims.breadth}" Plate`;
        price = MOCK_PRICING.wall.plates[`${dims.length}-${dims.breadth}`] || 0;
      } else if (category === "channels") {
        label = `${dims.height}ft Channel`;
        price = MOCK_PRICING.wall.channels[dims.height] || 0;
      } else if (category === "brackets") {
        const bracketSize = WALL_BRACKET_MAP[dims.breadth];
        label = `${bracketSize}" Bracket`;
        price = MOCK_PRICING.wall.brackets[bracketSize] || 0;
      } else if (category === "stoppers") {
        const stopperSize = WALL_STOPPER_MAP[dims.length];
        label = `${stopperSize}ft Stopper`;
        price = MOCK_PRICING.wall.stoppers[stopperSize] || 0;
      } else if (category === "screws") {
        label = "Screws";
        price = quote.hardwarePrices.screw;
      }
    }

    const newItem = {
      id: Date.now(),
      type: activeTab,
      isCustomPart: true,
      partCategory: category,
      partLabel: label,
      partPrice: price,
      qty: customItem.qty,
      dimensions: { ...dims },
      itemTotal: price * customItem.qty,
    };

    setCart((prev) => [...prev, newItem]);
    setCustomItem((prev) => ({ ...prev, qty: 1 })); // reset quantity
    setOverrides({});
  };

  const updateCartQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, qty: Math.max(0, item.qty + delta) }
            : item,
        )
        .filter((item) => item.qty > 0),
    );
    setOverrides({});
  };

  const handleOverrideChange = (itemKey, value) => {
    const val = value === "" ? "" : parseInt(value);
    setOverrides((prev) => ({ ...prev, [itemKey]: val }));
  };

  const handleShareSnapshot = async () => {
    if (!quoteRef.current) return;
    setIsCapturing(true);
    try {
      await new Promise((res) => setTimeout(res, 150)); // Slight delay to ensure UI updates

      const canvas = await html2canvas(quoteRef.current, {
        backgroundColor: "#111827",
        scale: 3,
        useCORS: true,
      });

      const imageBlob = await new Promise(
        (resolve) => canvas.toBlob(resolve, "image/png", 1.0), // Max quality PNG
      );
      const file = new File([imageBlob], "VARUN_Quote.png", {
        type: "image/png",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "VARUN Enterprise Quotation",
          text: "Rack quotation from VARUN Enterprise",
          files: [file],
        });
      } else {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png", 1.0);
        link.download = "VARUN_Quote.png";
        link.click();
      }
    } catch (err) {
      alert("Something went wrong while generating the snapshot.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!customerPhone) {
      alert("Please enter a 10-digit mobile number first.");
      return;
    }

    let formattedNumber = customerPhone.replace(/\D/g, "");
    if (formattedNumber.length === 10) {
      formattedNumber = "91" + formattedNumber;
    } else if (formattedNumber.length < 10) {
      alert("Please enter a valid mobile number.");
      return;
    }

    setIsCapturing(true);

    try {
      // 1. Generate the Image
      await new Promise((res) => setTimeout(res, 150));
      const canvas = await html2canvas(quoteRef.current, {
        backgroundColor: "#111827",
        scale: 2, // Standard scale for faster generation and copying
        useCORS: true,
      });

      // 2. Convert Canvas to Blob
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );

      // 3. Copy Image to Clipboard
      try {
        const item = new ClipboardItem({ "image/png": blob });
        await navigator.clipboard.write([item]);
      } catch (clipboardErr) {
        console.warn(
          "Clipboard write failed (might be blocked by browser):",
          clipboardErr,
        );
        alert(
          "Could not copy image to clipboard automatically. You can still use the Download button.",
        );
      }

      // 4. Build a quick text summary to go with it
      let textMessage = `*Quotation from VARUN Enterprise*\n`;
      textMessage += `*Total:* ₹${quote.grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}\n`;

      const encodedMessage = encodeURIComponent(textMessage);
      const whatsappUrl = `https://wa.me/${formattedNumber}?text=${encodedMessage}`;

      // 5. Open WhatsApp
      window.open(whatsappUrl, "_blank");
    } catch (err) {
      alert("Something went wrong while generating the quotation.");
      console.error(err);
    } finally {
      setIsCapturing(false);
    }
  };

  // --- CORE ENGINE ---
  const quote = useMemo(() => {
    return calculateQuote({
      cart,
      overrides,
      slottedFittingRate,
      wallFittingRate,
      pigeonFittingRate,
      gondolaFittingCharge,
      rickshawRent,
      isFittingOpted,
      applyMarkup,
    });
  }, [
    cart,
    overrides,
    slottedFittingRate,
    wallFittingRate,
    pigeonFittingRate,
    gondolaFittingCharge,
    rickshawRent,
    isFittingOpted,
    applyMarkup,
  ]);

  // UI Helpers
  const isSlotted = activeTab === "slotted";
  const isWall = activeTab === "wall";
  const isPigeon = activeTab === "pigeon";
  const currLength = isSlotted
    ? slottedDims.length
    : isWall
      ? wallDims.length
      : pigeonDims.length;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header & Tabs */}
      <div className="mb-8">
        <div className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center">
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 flex items-center gap-2 tracking-tight">
              <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm">
                <LayoutGrid className="text-white w-5 h-5" />
              </div>
              VARUN{" "}
              <span className="text-slate-400 font-medium">Enterprise</span>
            </h1>
          </div>
        </div>
        <div
          className="mt-4 flex bg-gray-200 p-1 rounded-xl w-full md:w-fit border border-gray-300 overflow-x-auto"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <button
            onClick={() => setActiveTab("slotted")}
            className={`flex-shrink-0 px-5 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === "slotted" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Slotted Angle Rack
          </button>
          <button
            onClick={() => setActiveTab("wall")}
            className={`flex-shrink-0 px-5 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === "wall" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Wall Mounted Rack
          </button>
          <button
            onClick={() => setActiveTab("pigeon")}
            className={`flex-shrink-0 px-5 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === "pigeon" ? "bg-white text-orange-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Pigeon Hole Rack
          </button>
          <button
            onClick={() => setActiveTab("gondola")}
            className={`flex-shrink-0 px-5 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === "gondola" ? "bg-white text-teal-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Gondola Rack
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Builder */}
        <div className="xl:col-span-7 space-y-8">
          {/* DIMENSIONS CARD */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            {/* HEADER */}
            <div className="px-6 py-5 border-b bg-gradient-to-r from-blue-50 via-white to-white">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <Ruler className="text-blue-600 w-5 h-5" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Rack Configuration
                  </h2>

                  <p className="text-sm text-gray-500">
                    Configure dimensions, structure, colors, and accessories.
                  </p>
                </div>
              </div>
            </div>

            {/* CONTENT */}
            <div className="p-6">
              {/* ====================== SLOTTED ====================== */}
              {isSlotted && (
                <div className="max-w-7xl mx-auto animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* PLATE */}
                    <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="font-semibold text-gray-800">
                          Plate Details
                        </h3>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Plate Breadth
                          </label>

                          <select
                            name="breadth"
                            value={slottedDims.breadth}
                            onChange={(e) => handleDimChange(e, "slotted")}
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                          >
                            <option value="12">12" (1 ft)</option>
                            <option value="15">15" (1.25 ft)</option>
                            <option value="18">18" (1.5 ft)</option>
                            <option value="24">24" (2 ft)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Plate Gauge
                          </label>

                          <select
                            name="plateGauge"
                            value={slottedDims.plateGauge}
                            onChange={(e) => handleDimChange(e, "slotted")}
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                          >
                            <option value={22}>22G (Standard)</option>
                            <option value={20}>20G (Heavy)</option>
                            <option value={18}>18G (Extra Heavy)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* ANGLE */}
                    <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="font-semibold text-gray-800">
                          Angle Structure
                        </h3>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Angle Height
                          </label>

                          <select
                            name="height"
                            value={slottedDims.height}
                            onChange={(e) => handleDimChange(e, "slotted")}
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                          >
                            <option value="3">3 ft</option>
                            <option value="4">4 ft</option>
                            <option value="5">5 ft</option>
                            <option value="6">6 ft</option>
                            <option value="6.5">6.5 ft</option>
                            <option value="7">7 ft</option>
                            <option value="8">8 ft</option>
                            <option value="10">10 ft</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Angle Gauge
                          </label>

                          <select
                            name="angleGauge"
                            value={slottedDims.angleGauge}
                            onChange={(e) => handleDimChange(e, "slotted")}
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                          >
                            <option value={16}>16G (Standard)</option>
                            <option value={14}>14G (Heavy)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* COLORS */}
                    <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="font-semibold text-gray-800">Colors</h3>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Plate Color
                          </label>

                          <select
                            name="plateColor"
                            value={slottedDims.plateColor}
                            onChange={(e) => handleDimChange(e, "slotted")}
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition"
                          >
                            <option value="standard">Standard Grey</option>

                            <option value="custom">
                              Custom Color (+ Extra Cost)
                            </option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Angle Color
                          </label>

                          <select
                            name="angleColor"
                            value={slottedDims.angleColor}
                            onChange={(e) => handleDimChange(e, "slotted")}
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition"
                          >
                            <option value="standard">Standard Grey</option>

                            <option value="custom">
                              Custom Color (+ Extra Cost)
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ====================== WALL ====================== */}
              {isWall && (
                <div className="animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* CARD */}
                    {[
                      {
                        label: "Plate Breadth",
                        name: "breadth",
                        value: wallDims.breadth,
                        options: [
                          ["6.25", '6.25"'],
                          ["9.25", '9.25"'],
                          ["12.25", '12.25"'],
                          ["14.25", '14.25"'],
                          ["16.25", '16.25"'],
                        ],
                      },
                      {
                        label: "Plate Gauge",
                        name: "plateGauge",
                        value: wallDims.plateGauge,
                        options: [
                          ["22", "22G (Standard)"],
                          ["20", "20G (Heavy)"],
                        ],
                      },
                      {
                        label: "Channel Height",
                        name: "height",
                        value: wallDims.height,
                        options: [
                          ["4", "4 ft"],
                          ["6", "6 ft"],
                        ],
                      },
                    ].map((field) => (
                      <div
                        key={field.name}
                        className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-5 shadow-sm"
                      >
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                          {field.label}
                        </label>

                        <select
                          name={field.name}
                          value={field.value}
                          onChange={(e) => handleDimChange(e, "wall")}
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                        >
                          {field.options.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}

                          {field.name === "plateGauge" &&
                            ["12.25", "14.25", "16.25"].includes(
                              wallDims.breadth,
                            ) && <option value="22D">22G (Double Part)</option>}
                        </select>
                      </div>
                    ))}

                    {/* STOPPER */}
                    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm flex items-center">
                      <label className="flex items-center gap-3 cursor-pointer w-full">
                        <input
                          type="checkbox"
                          name="hasStopper"
                          checked={wallDims.hasStopper}
                          onChange={(e) => handleDimChange(e, "wall")}
                          className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />

                        <div>
                          <p className="font-semibold text-indigo-900">
                            Front Stoppers
                          </p>

                          <p className="text-sm text-indigo-600">
                            Prevent products from falling
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ====================== PIGEON ====================== */}
              {isPigeon && (
                <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
                  {/* TOP GRID */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* DIMENSIONS */}
                    <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-orange-50/30 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="font-semibold text-gray-800">
                          Dimensions
                        </h3>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Total Width
                          </label>

                          <select
                            value={pigeonDims.length}
                            onChange={(e) =>
                              setPigeonDims({
                                ...pigeonDims,
                                length: e.target.value,
                              })
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                          >
                            <option value="2">2 ft (24")</option>
                            <option value="3">3 ft (36")</option>
                            <option value="4">4 ft (48")</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Depth
                          </label>

                          <select
                            value={pigeonDims.breadth}
                            onChange={(e) =>
                              setPigeonDims({
                                ...pigeonDims,
                                breadth: e.target.value,
                              })
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                          >
                            <option value="12">12" (1 ft)</option>
                            <option value="15">15" (1.25 ft)</option>
                            <option value="18">18" (1.5 ft)</option>
                            <option value="24">24" (2 ft)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Height
                          </label>

                          <select
                            value={pigeonDims.height}
                            onChange={(e) =>
                              setPigeonDims({
                                ...pigeonDims,
                                height: e.target.value,
                              })
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                          >
                            <option value="3">3 ft</option>
                            <option value="4">4 ft</option>
                            <option value="5">5 ft</option>
                            <option value="6">6 ft</option>
                            <option value="6.5">6.5 ft</option>
                            <option value="7">7 ft</option>
                            <option value="8">8 ft</option>
                            <option value="10">10 ft</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* STRUCTURE */}
                    <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-orange-50/30 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="font-semibold text-gray-800">
                          Structure
                        </h3>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Plate Gauge
                          </label>

                          <select
                            value={pigeonDims.plateGauge}
                            onChange={(e) =>
                              setPigeonDims({
                                ...pigeonDims,
                                plateGauge: parseInt(e.target.value),
                              })
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                          >
                            <option value={22}>22G (Standard)</option>
                            <option value={20}>20G (Heavy)</option>
                            <option value={18}>18G (Extra Heavy)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Angle Gauge
                          </label>

                          <select
                            value={pigeonDims.angleGauge}
                            onChange={(e) =>
                              setPigeonDims({
                                ...pigeonDims,
                                angleGauge: parseInt(e.target.value),
                              })
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                          >
                            <option value={16}>16G (Standard)</option>
                            <option value={14}>14G (Heavy)</option>
                          </select>
                        </div>

                        <label className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 cursor-pointer hover:bg-orange-100 transition">
                          <input
                            type="checkbox"
                            checked={pigeonDims.hasStopper}
                            onChange={(e) =>
                              setPigeonDims({
                                ...pigeonDims,
                                hasStopper: e.target.checked,
                              })
                            }
                            className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />

                          <div>
                            <p className="font-semibold text-orange-900">
                              Add Front Stoppers
                            </p>

                            <p className="text-sm text-orange-700">
                              Includes 3" product safety stopper
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* LAYOUT */}
                    <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-orange-50/30 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="font-semibold text-gray-800">Layout</h3>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Plates / Rack
                          </label>

                          <input
                            type="number"
                            min="2"
                            max="20"
                            value={pigeonDims.rows}
                            onChange={(e) =>
                              setPigeonDims({
                                ...pigeonDims,
                                rows: parseInt(e.target.value),
                              })
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Vertical Columns
                          </label>

                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={pigeonDims.columns}
                            onChange={(e) =>
                              setPigeonDims({
                                ...pigeonDims,
                                columns: parseInt(e.target.value),
                              })
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RESULT + CTA */}
                  <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-orange-50 p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    {/* RESULT */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-2">
                        Calculated Box Size
                      </p>

                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="bg-white border border-orange-200 rounded-xl px-4 py-3 shadow-sm">
                          <p className="text-sm text-gray-500">
                            Individual Box
                          </p>

                          <p className="font-mono font-bold text-lg text-orange-800">
                            {(
                              (parseInt(pigeonDims.length) * 12) /
                              pigeonDims.columns
                            ).toFixed(1)}
                            " × {pigeonDims.breadth}" ×{" "}
                            {(
                              (parseInt(pigeonDims.height) * 12 - 3) /
                              Math.max(1, pigeonDims.rows - 1)
                            ).toFixed(1)}
                            "
                          </p>
                        </div>

                        <div className="bg-orange-100 text-orange-700 text-sm font-medium px-3 py-2 rounded-lg">
                          {pigeonDims.rows * pigeonDims.columns} Total
                          Compartments
                        </div>
                      </div>
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => {
                        setCart((prev) => [
                          ...prev,
                          {
                            id: Date.now(),
                            type: "pigeon",
                            dimensions: { ...pigeonDims },
                            bays: [parseInt(pigeonDims.length)],
                            shelvesPerRack: pigeonDims.rows,
                            qty: 1,
                          },
                        ]);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] transition-all text-white font-semibold px-6 py-3 shadow-md hover:shadow-lg"
                    >
                      <PackagePlus className="w-5 h-5" />
                      Add Pigeon Rack
                    </button>
                  </div>
                </div>
              )}

              {/* --- GONDOLA RACK EDITOR --- */}
              {activeTab === "gondola" && (
                <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
                  {/* CONFIGURATION CARD */}
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                      {/* LENGTH */}
                      <div>
                        <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">
                          Length
                        </label>

                        <select
                          value={gondolaDims.length}
                          onChange={(e) =>
                            setGondolaDims({
                              ...gondolaDims,
                              length: e.target.value,
                            })
                          }
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition"
                        >
                          <option value="3">3 ft</option>
                          <option value="4">4 ft</option>
                        </select>
                      </div>

                      {/* HEIGHT */}
                      <div>
                        <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">
                          Stand Height
                        </label>

                        <select
                          value={gondolaDims.height}
                          onChange={(e) =>
                            setGondolaDims({
                              ...gondolaDims,
                              height: e.target.value,
                            })
                          }
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition"
                        >
                          <option value="4">4 ft</option>
                          <option value="5">5 ft</option>
                          <option value="6">6 ft</option>
                          <option value="7">7 ft</option>
                        </select>
                      </div>

                      {/* BREADTH */}
                      <div>
                        <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">
                          Plate Breadth
                        </label>

                        <select
                          value={gondolaDims.breadth}
                          onChange={(e) => {
                            const val = e.target.value;

                            const isDoubleAllowed = [
                              "12.25",
                              "14.25",
                              "16.25",
                            ].includes(val);

                            if (
                              gondolaDims.plateGauge === "22D" &&
                              !isDoubleAllowed
                            ) {
                              setGondolaDims({
                                ...gondolaDims,
                                breadth: val,
                                plateGauge: "22",
                              });
                            } else {
                              setGondolaDims({
                                ...gondolaDims,
                                breadth: val,
                              });
                            }
                          }}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition"
                        >
                          <option value="6.25">6.25"</option>
                          <option value="9.25">9.25"</option>
                          <option value="12.25">12.25"</option>
                          <option value="14.25">14.25"</option>
                          <option value="16.25">16.25"</option>
                        </select>
                      </div>

                      {/* GAUGE */}
                      <div>
                        <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">
                          Plate Gauge
                        </label>

                        <select
                          value={gondolaDims.plateGauge}
                          onChange={(e) =>
                            setGondolaDims({
                              ...gondolaDims,
                              plateGauge: e.target.value,
                            })
                          }
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition"
                        >
                          <option value="22">22G (Standard)</option>
                          <option value="20">20G (Heavy)</option>

                          {["12.25", "14.25", "16.25"].includes(
                            gondolaDims.breadth,
                          ) && <option value="22D">22G (Double Part)</option>}
                        </select>
                      </div>

                      {/* SHELVES */}
                      <div>
                        <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">
                          Shelves / Side
                        </label>

                        <input
                          type="number"
                          min="1"
                          max={MAX_SHELVES}
                          value={gondolaDims.shelves}
                          onChange={(e) =>
                            setGondolaDims({
                              ...gondolaDims,
                              shelves: parseInt(e.target.value) || "",
                            })
                          }
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition"
                        />
                      </div>
                    </div>
                  </div>

                  {/* OPTIONS + ACTION */}
                  <div className="bg-gradient-to-r from-teal-50 to-white border border-teal-200 rounded-2xl shadow-sm p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    {/* OPTIONS */}
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={gondolaDims.isDoubleSided}
                          onChange={(e) =>
                            setGondolaDims({
                              ...gondolaDims,
                              isDoubleSided: e.target.checked,
                            })
                          }
                          className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />

                        <div>
                          <p className="font-semibold text-gray-800 group-hover:text-teal-700 transition">
                            Double Sided Rack
                          </p>
                          <p className="text-sm text-gray-500">
                            Plates on both sides
                          </p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={gondolaDims.hasStopper}
                          onChange={(e) =>
                            setGondolaDims({
                              ...gondolaDims,
                              hasStopper: e.target.checked,
                            })
                          }
                          className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />

                        <div>
                          <p className="font-semibold text-gray-800 group-hover:text-teal-700 transition">
                            Front Stoppers
                          </p>
                          <p className="text-sm text-gray-500">
                            Prevent products from falling
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* ACTION BUTTON */}
                    <button
                      onClick={() => {
                        setCart((prev) => [
                          ...prev,
                          {
                            id: Date.now(),
                            type: "gondola",
                            dimensions: { ...gondolaDims },
                            bays: [parseInt(gondolaDims.length)],
                            shelvesPerRack: gondolaDims.shelves,
                            qty: 1,
                          },
                        ]);
                      }}
                      className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] transition-all text-white font-semibold px-6 py-3 rounded-xl shadow-md hover:shadow-lg"
                    >
                      <PackagePlus className="w-5 h-5" />
                      Add Gondola Rack
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BUILDER CARD */}
          {!isPigeon && activeTab !== "gondola" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-100 p-4 border-b border-gray-200 flex gap-4">
                <button
                  onClick={() => setBuildMode("standard")}
                  className={`px-4 py-2 rounded-lg font-bold transition-colors ${buildMode === "standard" ? (isSlotted ? "bg-blue-600 text-white" : "bg-indigo-600 text-white") : "text-gray-600 hover:bg-gray-200"}`}
                >
                  Standard Rack
                </button>
                <button
                  onClick={() => setBuildMode("mixed")}
                  className={`px-4 py-2 rounded-lg font-bold transition-colors ${buildMode === "mixed" ? (isSlotted ? "bg-blue-600 text-white" : "bg-indigo-600 text-white") : "text-gray-600 hover:bg-gray-200"}`}
                >
                  Mixed Rack
                </button>
                <button
                  onClick={() => setBuildMode("custom")}
                  className={`px-4 py-2 rounded-lg font-bold transition-colors ${buildMode === "custom" ? (isSlotted ? "bg-blue-600 text-white" : "bg-indigo-600 text-white") : "text-gray-600 hover:bg-gray-200"}`}
                >
                  Custom Parts
                </button>
              </div>

              <div className="p-6">
                {buildMode === "standard" ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-4 mb-4">
                      <label className="font-medium text-gray-700 text-sm whitespace-nowrap">
                        Plate Length:
                      </label>
                      <select
                        value={isSlotted ? slottedDims.length : wallDims.length}
                        onChange={(e) =>
                          handleDimChange(e, isSlotted ? "slotted" : "wall")
                        }
                        name="length"
                        className={`border-gray-300 rounded-md shadow-sm p-2 border ${isSlotted ? "focus:ring-blue-500" : "focus:ring-indigo-500"}`}
                      >
                        {isSlotted ? (
                          <>
                            <option value="2">2 ft (24")</option>
                            <option value="3">3 ft (36")</option>
                            <option value="4">4 ft (48")</option>
                          </>
                        ) : (
                          <>
                            <option value="35.5">35.5" (~3 ft)</option>
                            <option value="47.5">47.5" (~4 ft)</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="flex pb-4 mb-4">
                      <div
                        ref={scrollContainerRef}
                        className="max-h-[350px] overflow-auto border border-gray-100 rounded-lg shadow-inner bg-gray-50 p-4 w-full"
                      >
                        <div
                          className="grid gap-1 min-w-max"
                          style={{
                            gridTemplateColumns: `repeat(${MAX_RACKS}, minmax(0, 1fr))`,
                          }}
                          onMouseLeave={() => setHoveredCell({ x: 0, y: 0 })}
                        >
                          {Array.from({ length: MAX_SHELVES }).map(
                            (_, rowIndex) => {
                              const y = MAX_SHELVES - rowIndex;
                              return Array.from({ length: MAX_RACKS }).map(
                                (_, colIndex) => {
                                  const x = colIndex + 1;
                                  const isSelected =
                                    x <= selectedCell.x && y <= selectedCell.y;
                                  const isHovered =
                                    x <= hoveredCell.x && y <= hoveredCell.y;
                                  const activeColor = isSlotted
                                    ? "bg-blue-600 border-blue-700"
                                    : "bg-indigo-600 border-indigo-700";
                                  const hoverColor = isSlotted
                                    ? "bg-blue-200 border-blue-400"
                                    : "bg-indigo-200 border-indigo-400";
                                  return (
                                    <div
                                      key={`${x}-${y}`}
                                      className={`w-6 h-6 md:w-8 md:h-8 border rounded cursor-pointer transition-colors duration-150 flex-shrink-0 ${isSelected ? activeColor : isHovered ? hoverColor : "bg-white border-gray-300"}`}
                                      onMouseEnter={() =>
                                        setHoveredCell({ x, y })
                                      }
                                      onClick={() => handleGridClick(x, y)}
                                      title={`Racks: ${x}, Shelves: ${y}`}
                                    />
                                  );
                                },
                              );
                            },
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-gray-100 gap-4">
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <label className="font-medium text-gray-700 text-sm">
                            Joined Racks:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={MAX_RACKS}
                            value={selectedCell.x}
                            onChange={(e) =>
                              handleStructureInputChange("x", e.target.value)
                            }
                            className={`w-16 border border-gray-300 rounded p-1.5 text-center font-bold outline-none focus:ring-1 ${isSlotted ? "text-blue-600 focus:ring-blue-500" : "text-indigo-600 focus:ring-indigo-500"}`}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="font-medium text-gray-700 text-sm">
                            Shelves/Rack:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={MAX_SHELVES}
                            value={selectedCell.y}
                            onChange={(e) =>
                              handleStructureInputChange("y", e.target.value)
                            }
                            className={`w-16 border border-gray-300 rounded p-1.5 text-center font-bold outline-none focus:ring-1 ${isSlotted ? "text-blue-600 focus:ring-blue-500" : "text-indigo-600 focus:ring-indigo-500"}`}
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleAddToCart}
                        disabled={selectedCell.x === 0 || selectedCell.y === 0}
                        className={`w-full sm:w-auto disabled:bg-gray-300 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 ${isSlotted ? "bg-blue-600 hover:bg-blue-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
                      >
                        <PackagePlus className="w-5 h-5" /> Add to Quote
                      </button>
                    </div>
                  </div>
                ) : buildMode === "mixed" ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
                    <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <label className="font-bold text-gray-700">
                        Shelves per Rack:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={MAX_SHELVES}
                        value={mixedShelves}
                        onChange={(e) =>
                          setMixedShelves(
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value),
                          )
                        }
                        className={`w-20 border border-gray-300 rounded p-2 text-center font-bold outline-none ${isSlotted ? "text-blue-600" : "text-indigo-600"}`}
                      />
                    </div>

                    <div>
                      {/* --- HEADER WITH UNDO BUTTON --- */}
                      <div className="flex justify-between items-center mb-3">
                        <label className="font-bold text-gray-700">
                          Append Racks to Row:
                        </label>
                        <button
                          onClick={() =>
                            setMixedBays((prev) => prev.slice(0, -1))
                          }
                          disabled={mixedBays.length === 0}
                          className="bg-gray-100 disabled:opacity-50 hover:bg-red-100 hover:text-red-600 text-gray-600 font-bold py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1.5 text-sm"
                        >
                          <Undo2 className="w-4 h-4" /> Undo Last
                        </button>
                      </div>

                      {/* --- ADD RACK BUTTONS (Now with flex-wrap) --- */}
                      <div className="flex flex-wrap gap-3">
                        {isSlotted ? (
                          <>
                            <button
                              onClick={() => setMixedBays([...mixedBays, 2])}
                              className="bg-white border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 text-blue-700 font-bold py-3 px-2 rounded-lg transition-colors shadow-sm flex items-center gap-2 flex-1 sm:flex-none justify-center"
                            >
                              <Plus className="w-5 h-5" /> 2 ft Rack
                            </button>
                            <button
                              onClick={() => setMixedBays([...mixedBays, 3])}
                              className="bg-white border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 text-blue-700 font-bold py-3 px-2 rounded-lg transition-colors shadow-sm flex items-center gap-2 flex-1 sm:flex-none justify-center"
                            >
                              <Plus className="w-5 h-5" /> 3 ft Rack
                            </button>
                            <button
                              onClick={() => setMixedBays([...mixedBays, 4])}
                              className="bg-white border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 text-blue-700 font-bold py-3 px-2 rounded-lg transition-colors shadow-sm flex items-center gap-2 flex-1 sm:flex-none justify-center"
                            >
                              <Plus className="w-5 h-5" /> 4 ft Rack
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setMixedBays([...mixedBays, 35.5])}
                              className="bg-white border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50 text-indigo-700 font-bold py-3 px-6 rounded-lg transition-colors shadow-sm flex items-center gap-2 flex-1 sm:flex-none justify-center"
                            >
                              <Plus className="w-5 h-5" /> 35.5" Rack
                            </button>
                            <button
                              onClick={() => setMixedBays([...mixedBays, 47.5])}
                              className="bg-white border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50 text-indigo-700 font-bold py-3 px-6 rounded-lg transition-colors shadow-sm flex items-center gap-2 flex-1 sm:flex-none justify-center"
                            >
                              <Plus className="w-5 h-5" /> 47.5" Rack
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded-xl p-6 shadow-inner text-white overflow-x-auto min-h-[140px] flex flex-col justify-center">
                      {mixedBays.length === 0 ? (
                        <p className="text-slate-500 text-center italic">
                          Your row is empty. Add racks above to start building.
                        </p>
                      ) : (
                        <div>
                          <div className="flex items-stretch min-w-max">
                            <div
                              className="w-2 bg-slate-400 rounded-full flex-shrink-0"
                              title="Upright"
                            ></div>
                            {mixedBays.map((bay, idx) => (
                              <React.Fragment key={idx}>
                                <div className="flex flex-col items-center justify-center px-4 md:px-8 border-y-2 border-slate-700 flex-grow text-slate-300 font-mono font-bold">
                                  {isSlotted ? `${bay} ft` : `${bay}"`}
                                </div>
                                <div
                                  className="w-2 bg-slate-400 rounded-full flex-shrink-0"
                                  title="Shared Upright"
                                ></div>
                              </React.Fragment>
                            ))}
                          </div>
                          <p
                            className={`text-center mt-4 font-bold tracking-widest ${isSlotted ? "text-emerald-400" : "text-indigo-400"}`}
                          >
                            TOTAL SPAN:{" "}
                            {isSlotted
                              ? `${mixedBays.reduce((a, b) => a + b, 0)} ft`
                              : `${Math.round(mixedBays.reduce((a, b) => a + b / 12, 0))} ft`}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                      <button
                        onClick={handleAddToCart}
                        disabled={mixedBays.length === 0}
                        className={`w-full sm:w-auto disabled:bg-gray-300 text-white font-bold py-3 px-8 rounded-lg transition-colors flex items-center justify-center gap-2 ${isSlotted ? "bg-blue-600 hover:bg-blue-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
                      >
                        <PackagePlus className="w-5 h-5" /> Add Rack to Quote
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 p-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      {/* 1. PART TYPE SELECTOR */}
                      <div className="col-span-2 md:col-span-1">
                        <label className="font-medium text-gray-700 text-sm mb-1 block">
                          Part Type:
                        </label>
                        <select
                          value={customItem.category}
                          onChange={(e) =>
                            setCustomItem({
                              ...customItem,
                              category: e.target.value,
                            })
                          }
                          className={`w-full border-gray-300 rounded-md shadow-sm p-2 border ${isSlotted ? "focus:ring-blue-500" : "focus:ring-indigo-500"}`}
                        >
                          {isSlotted ? (
                            <>
                              <option value="plates">Plates</option>
                              <option value="angles">Angles</option>
                              <option value="bolts">Nut/Bolts</option>
                              <option value="corners">Corner Supports</option>
                              <option value="bushes">Rubber Bushes</option>
                            </>
                          ) : (
                            <>
                              <option value="plates">Plates</option>
                              <option value="channels">Channels</option>
                              <option value="brackets">Brackets</option>
                              <option value="stoppers">Stoppers</option>
                              <option value="screws">Screws</option>
                            </>
                          )}
                        </select>
                      </div>

                      {/* 2. LENGTH (For Plates & Stoppers) */}
                      {(customItem.category === "plates" ||
                        customItem.category === "stoppers") && (
                        <div>
                          <label className="font-medium text-gray-700 text-sm mb-1 block">
                            Length:
                          </label>
                          <select
                            value={
                              isSlotted ? slottedDims.length : wallDims.length
                            }
                            onChange={(e) =>
                              handleDimChange(e, isSlotted ? "slotted" : "wall")
                            }
                            name="length"
                            className={`w-full border-gray-300 rounded-md shadow-sm p-2 border ${isSlotted ? "focus:ring-blue-500" : "focus:ring-indigo-500"}`}
                          >
                            {isSlotted ? (
                              <>
                                <option value="2">2 ft (24")</option>
                                <option value="3">3 ft (36")</option>
                                <option value="4">4 ft (48")</option>
                              </>
                            ) : (
                              <>
                                <option value="35.5">35.5" (~3 ft)</option>
                                <option value="47.5">47.5" (~4 ft)</option>
                              </>
                            )}
                          </select>
                        </div>
                      )}

                      {/* 3. BREADTH/DEPTH (For Plates & Brackets) */}
                      {(customItem.category === "plates" ||
                        customItem.category === "brackets") && (
                        <div>
                          <label className="font-medium text-gray-700 text-sm mb-1 block">
                            Depth/Breadth:
                          </label>
                          <select
                            value={
                              isSlotted ? slottedDims.breadth : wallDims.breadth
                            }
                            onChange={(e) =>
                              handleDimChange(e, isSlotted ? "slotted" : "wall")
                            }
                            name="breadth"
                            className={`w-full border-gray-300 rounded-md shadow-sm p-2 border ${isSlotted ? "focus:ring-blue-500" : "focus:ring-indigo-500"}`}
                          >
                            {isSlotted ? (
                              <>
                                <option value="12">12" (1 ft)</option>
                                <option value="15">15" (1.25 ft)</option>
                                <option value="18">18" (1.5 ft)</option>
                                <option value="24">24" (2 ft)</option>
                              </>
                            ) : (
                              <>
                                <option value="6.25">6.25"</option>
                                <option value="9.25">9.25"</option>
                                <option value="12.25">12.25"</option>
                                <option value="14.25">14.25"</option>
                                <option value="16.25">16.25"</option>
                              </>
                            )}
                          </select>
                        </div>
                      )}

                      {/* 4. PLATE GAUGE (Slotted Plates Only) */}
                      {isSlotted && customItem.category === "plates" && (
                        <div>
                          <label className="font-medium text-gray-700 text-sm mb-1 block">
                            Plate Gauge:
                          </label>
                          <select
                            value={slottedDims.plateGauge}
                            onChange={(e) => handleDimChange(e, "slotted")}
                            name="plateGauge"
                            className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500"
                          >
                            <option value={22}>22G (Std)</option>
                            <option value={20}>20G (Heavy)</option>
                            <option value={18}>18G (Extra)</option>
                          </select>
                        </div>
                      )}

                      {/* 5. HEIGHT (For Angles & Channels) */}
                      {(customItem.category === "angles" ||
                        customItem.category === "channels") && (
                        <div>
                          <label className="font-medium text-gray-700 text-sm mb-1 block">
                            Height:
                          </label>
                          <select
                            value={
                              isSlotted ? slottedDims.height : wallDims.height
                            }
                            onChange={(e) =>
                              handleDimChange(e, isSlotted ? "slotted" : "wall")
                            }
                            name="height"
                            className={`w-full border-gray-300 rounded-md shadow-sm p-2 border ${isSlotted ? "focus:ring-blue-500" : "focus:ring-indigo-500"}`}
                          >
                            {isSlotted ? (
                              <>
                                <option value="3">3 ft</option>
                                <option value="4">4 ft</option>
                                <option value="5">5 ft</option>
                                <option value="6">6 ft</option>
                                <option value="6.5">6.5 ft</option>
                                <option value="7">7 ft</option>
                                <option value="8">8 ft</option>
                                <option value="10">10 ft</option>
                              </>
                            ) : (
                              <>
                                <option value="4">4 ft</option>
                                <option value="6">6 ft</option>
                              </>
                            )}
                          </select>
                        </div>
                      )}

                      {/* 6. ANGLE GAUGE (Slotted Angles Only) */}
                      {isSlotted && customItem.category === "angles" && (
                        <div>
                          <label className="font-medium text-gray-700 text-sm mb-1 block">
                            Angle Gauge:
                          </label>
                          <select
                            value={slottedDims.angleGauge}
                            onChange={(e) => handleDimChange(e, "slotted")}
                            name="angleGauge"
                            className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500"
                          >
                            <option value={16}>16G (Std)</option>
                            <option value={14}>14G (Heavy)</option>
                          </select>
                        </div>
                      )}

                      {/* PLATE COLOR (Only for custom plates) */}
                      {isSlotted && customItem.category === "plates" && (
                        <div>
                          <label className="font-medium text-gray-700 text-sm mb-1 block">
                            Plate Color:
                          </label>
                          <select
                            value={slottedDims.plateColor}
                            onChange={(e) => handleDimChange(e, "slotted")}
                            name="plateColor"
                            className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 border-blue-200 bg-blue-50/30"
                          >
                            <option value="standard">Standard Grey</option>
                            <option value="custom">Custom Color</option>
                          </select>
                        </div>
                      )}

                      {/* ANGLE COLOR (Only for custom angles) */}
                      {isSlotted && customItem.category === "angles" && (
                        <div>
                          <label className="font-medium text-gray-700 text-sm mb-1 block">
                            Angle Color:
                          </label>
                          <select
                            value={slottedDims.angleColor}
                            onChange={(e) => handleDimChange(e, "slotted")}
                            name="angleColor"
                            className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-blue-500 border-blue-200 bg-blue-50/30"
                          >
                            <option value="standard">Standard Grey</option>
                            <option value="custom">Custom Color</option>
                          </select>
                        </div>
                      )}

                      {/* 7. QUANTITY */}
                      <div>
                        <label className="font-medium text-gray-700 text-sm mb-1 block">
                          Quantity:
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={customItem.qty}
                          onChange={(e) =>
                            setCustomItem({
                              ...customItem,
                              qty:
                                e.target.value === ""
                                  ? ""
                                  : parseInt(e.target.value),
                            })
                          }
                          className={`w-full border-gray-300 rounded-md shadow-sm p-2 border outline-none ${isSlotted ? "focus:ring-1 focus:ring-blue-500" : "focus:ring-1 focus:ring-indigo-500"}`}
                        />
                      </div>
                    </div>

                    {/* ADD BUTTON */}
                    <div className="flex justify-end pt-4 border-t border-gray-100">
                      <button
                        onClick={handleAddCustomItem}
                        className={`w-full sm:w-auto text-white font-bold py-3 px-8 rounded-lg transition-colors flex items-center justify-center gap-2 ${isSlotted ? "bg-blue-600 hover:bg-blue-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
                      >
                        <PackagePlus className="w-5 h-5" /> Add Part to Quote
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Summary & Quotation */}
        <div className="xl:col-span-5 space-y-6">
          {/* CART SUMMARY BLOCK */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-100 p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-gray-600" /> Cart
              </h2>
              <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-full">
                {cart.length}
              </span>
            </div>

            <div className="p-4 max-h-[450px] overflow-y-auto">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Your cart is empty. Configure a rack on the left and click
                  "Add to Quote".
                </div>
              ) : (
                <div className="space-y-3">
                  {quote?.enrichedCart.map((item) => {
                    const isSlotted = item.type === "slotted";
                    const isPigeon = item.type === "pigeon";
                    const wall = item.type === "wall";
                    const isGondola = item.type === "gondola";
                    if (item.isCustomPart) {
                      return (
                        <div
                          key={item.id}
                          className="border border-gray-200 bg-white rounded-lg shadow-sm overflow-hidden transition-all"
                        >
                          <div className="flex justify-between items-center p-3">
                            <div className="flex-1 pr-4">
                              <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                                <Wrench
                                  className={`w-3.5 h-3.5 ${wall ? "text-indigo-500" : "text-blue-500"}`}
                                />
                                Custom Part
                              </p>
                              <p className="text-xs text-gray-600 mt-1 font-medium">
                                {item.partLabel}
                              </p>
                              <p className="text-sm font-bold text-green-600 mt-1">
                                ₹
                                {item.itemTotal.toLocaleString("en-IN", {
                                  maximumFractionDigits: 0,
                                })}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-md p-1 shadow-sm">
                                <button
                                  onClick={() => updateCartQty(item.id, -1)}
                                  className="p-1 hover:bg-white rounded text-gray-600 transition-colors"
                                >
                                  {item.qty === 1 ? (
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  ) : (
                                    <Minus className="w-4 h-4" />
                                  )}
                                </button>
                                <span className="w-5 text-center font-bold text-sm">
                                  {item.qty}
                                </span>
                                <button
                                  onClick={() => updateCartQty(item.id, 1)}
                                  className="p-1 hover:bg-white rounded text-gray-600 transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const isMixed = new Set(item.bays).size > 1;

                    // --- Text Formatting ---
                    const rackName = isSlotted
                      ? "Slotted Angle Rack"
                      : isPigeon
                        ? "Pigeon Hole Rack"
                        : isGondola
                          ? "Gondola Rack"
                          : "Wall Mounted Rack";
                    const isInchBased = item.type === "wall";
                    const totalSpan = isInchBased
                      ? `${Math.round(item.bays.reduce((a, b) => a + b / 12, 0))} ft`
                      : `${item.bays.reduce((a, b) => a + b, 0)} ft`;

                    const joinedLabel =
                      item.bays.length > 1
                        ? `${item.bays.length} Joined Racks`
                        : `1 Standalone Rack`;

                    const spanLabel =
                      isPigeon || isGondola
                        ? `(${item.bays[0]} ft)`
                        : isMixed
                          ? `Mixed Span (${item.bays.join("+")} ${isInchBased ? '"' : "ft"})`
                          : `${joinedLabel} (${item.bays[0]} ${isInchBased ? '"' : "ft"})`;

                    const isExpanded = expandedCartId === item.id;

                    // --- Material Calculations (for this specific row) ---
                    const totalAngles = (item.bays.length + 1) * item.qty * 2;
                    const platesPerBay = item.shelvesPerRack * item.qty;

                    // Group plates by size for this row
                    const uniqueBays = {};
                    item.bays.forEach((b) => {
                      uniqueBays[b] = (uniqueBays[b] || 0) + platesPerBay;
                    });

                    return (
                      <div
                        key={item.id}
                        className="border border-gray-200 bg-white rounded-lg shadow-sm overflow-hidden transition-all"
                      >
                        {/* COMPACT HEADER (Clickable) */}
                        <div
                          className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50"
                          onClick={() =>
                            setExpandedCartId(isExpanded ? null : item.id)
                          }
                        >
                          <div className="flex-1 pr-4">
                            <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                              <Layers
                                className={`w-3.5 h-3.5 ${wall ? "text-indigo-500" : "text-blue-500"}`}
                              />
                              {rackName}
                            </p>
                            <p className="text-xs text-gray-600 mt-1 font-medium">
                              {isPigeon
                                ? spanLabel
                                : `${spanLabel} • ${totalSpan} Length`}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {item.dimensions.breadth}" Depth •{" "}
                              {item.dimensions.height}' High •{" "}
                              {item.shelvesPerRack} Shelves/Rack
                              {wall &&
                                item.dimensions.hasStopper &&
                                " • (W/ Stoppers)"}
                            </p>
                            <p className="text-sm font-bold text-green-600 mt-1">
                              ₹
                              {item.itemTotal.toLocaleString("en-IN", {
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          </div>

                          {/* Controls */}
                          <div className="flex items-center gap-3">
                            <div
                              className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-md p-1 shadow-sm"
                              onClick={(e) => e.stopPropagation()} // Prevents the card from expanding when clicking quantity
                            >
                              <button
                                onClick={() => updateCartQty(item.id, -1)}
                                className="p-1 hover:bg-white rounded text-gray-600 transition-colors"
                              >
                                {item.qty === 1 ? (
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                ) : (
                                  <Minus className="w-4 h-4" />
                                )}
                              </button>
                              <span className="w-5 text-center font-bold text-sm">
                                {item.qty}
                              </span>
                              <button
                                onClick={() => updateCartQty(item.id, 1)}
                                className="p-1 hover:bg-white rounded text-gray-600 transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>

                        {/* EXPANDED MATERIAL BREAKDOWN */}
                        {isExpanded && (
                          <div className="bg-gray-50 p-3 border-t border-gray-100 text-xs text-gray-600">
                            <h4 className="font-bold text-gray-700 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">
                              Included Materials (for {item.qty}{" "}
                              {item.qty > 1 ? "Units" : "Unit"})
                            </h4>
                            <ul className="space-y-1.5 font-mono">
                              {/* --- DEFAULT PLATES & FRAMES (Hides for Pigeon & Gondola) --- */}
                              {!isPigeon && !isGondola && (
                                <>
                                  {/* Plates*/}
                                  {Object.entries(uniqueBays).map(
                                    ([baySize, count]) => (
                                      <li
                                        key={baySize}
                                        className="flex justify-between"
                                      >
                                        <span>
                                          {baySize}
                                          {isSlotted ? "'" : '"'} x{" "}
                                          {item.dimensions.breadth}" Plates
                                          {!wall &&
                                            ` (${item.dimensions.plateGauge}G)`}
                                        </span>
                                        <strong className="text-gray-800">
                                          {count} pc
                                        </strong>
                                      </li>
                                    ),
                                  )}

                                  {/* Frames*/}
                                  <li className="flex justify-between">
                                    <span>
                                      {item.dimensions.height}ft{" "}
                                      {isSlotted ? "Angles" : "Channels"}
                                      {!wall &&
                                        ` (${item.dimensions.angleGauge}G)`}
                                    </span>
                                    <strong className="text-gray-800">
                                      {totalAngles} pc
                                    </strong>
                                  </li>
                                </>
                              )}

                              {/* Wall Specifics */}
                              {wall && (
                                <>
                                  <li className="flex justify-between">
                                    <span>
                                      {
                                        WALL_BRACKET_MAP[
                                          item.dimensions.breadth
                                        ]
                                      }
                                      " Brackets
                                    </span>
                                    <strong className="text-gray-800">
                                      {(item.bays.length +
                                        1 +
                                        (item.dimensions.hasStopper
                                          ? Math.max(0, item.bays.length - 1)
                                          : 0)) *
                                        item.shelvesPerRack *
                                        item.qty}{" "}
                                      pc
                                    </strong>
                                  </li>
                                  {item.dimensions.hasStopper &&
                                    Object.entries(uniqueBays).map(
                                      ([baySize, count]) => (
                                        <li
                                          key={`stop-${baySize}`}
                                          className="flex justify-between"
                                        >
                                          <span>
                                            {WALL_STOPPER_MAP[baySize]}ft
                                            Stoppers
                                          </span>
                                          <strong className="text-gray-800">
                                            {count} pc
                                          </strong>
                                        </li>
                                      ),
                                    )}
                                  <li className="flex justify-between">
                                    <span>Screws</span>
                                    <strong className="text-gray-800">
                                      {totalAngles *
                                        (item.dimensions.height === "4"
                                          ? 5
                                          : 7)}{" "}
                                      pc
                                    </strong>
                                  </li>
                                </>
                              )}

                              {/* Slotted Specifics */}
                              {isSlotted && (
                                <>
                                  <li className="flex justify-between">
                                    <span>Nut/Bolts</span>
                                    <strong className="text-gray-800">
                                      {totalAngles *
                                        (item.shelvesPerRack >= 2
                                          ? 2 * item.shelvesPerRack + 4
                                          : 8)}{" "}
                                      pc
                                    </strong>
                                  </li>
                                  <li className="flex justify-between">
                                    <span>Corner Supports</span>
                                    <strong className="text-gray-800">
                                      {totalAngles * 2} pc
                                    </strong>
                                  </li>
                                  <li className="flex justify-between">
                                    <span>Rubber Bushes</span>
                                    <strong className="text-gray-800">
                                      {totalAngles} pc
                                    </strong>
                                  </li>
                                </>
                              )}

                              {/* Pigeon Specifics */}
                              {isPigeon && (
                                <>
                                  <li className="flex justify-between">
                                    <span>
                                      {item.bays[0]}ft x{" "}
                                      {item.dimensions.height}ft Back Cladding
                                    </span>
                                    <strong className="text-gray-800">
                                      {1 * item.qty} pc
                                    </strong>
                                  </li>
                                  <li className="flex justify-between">
                                    <span>
                                      {item.dimensions.breadth}" x{" "}
                                      {item.dimensions.height}ft Side Cladding
                                    </span>
                                    <strong className="text-gray-800">
                                      {2 * item.qty} pc
                                    </strong>
                                  </li>
                                  {item.dimensions.columns > 1 && (
                                    <li className="flex justify-between">
                                      <span>
                                        {item.dimensions.breadth}" D x{" "}
                                        {(
                                          (parseFloat(item.dimensions.height) *
                                            12 -
                                            3) /
                                          Math.max(1, item.shelvesPerRack - 1)
                                        ).toFixed(1)}
                                        " H Dividers
                                      </span>
                                      <strong className="text-gray-900">
                                        {(item.dimensions.columns - 1) *
                                          Math.max(1, item.shelvesPerRack - 1) *
                                          item.qty}{" "}
                                        pc
                                      </strong>
                                    </li>
                                  )}
                                  {item.dimensions.hasStopper && (
                                    <li className="flex justify-between">
                                      <span>
                                        {item.bays[0]}ft x 3" Stoppers
                                      </span>
                                      <strong className="text-gray-800">
                                        {(item.shelvesPerRack - 1) * item.qty}{" "}
                                        pc
                                      </strong>
                                    </li>
                                  )}
                                  <li className="flex justify-between">
                                    <span>Nut/Bolts</span>
                                    <strong className="text-gray-800">
                                      {totalAngles *
                                        (item.shelvesPerRack >= 2
                                          ? 2 * item.shelvesPerRack + 4
                                          : 8) +
                                        2 *
                                          item.shelvesPerRack *
                                          (item.dimensions.columns - 1) *
                                          item.qty}{" "}
                                      pc
                                    </strong>
                                  </li>
                                  <li className="flex justify-between">
                                    <span>Corner Supports</span>
                                    <strong className="text-gray-800">
                                      {totalAngles} pc
                                    </strong>
                                  </li>
                                  <li className="flex justify-between">
                                    <span>Rubber Bushes</span>
                                    <strong className="text-gray-800">
                                      {totalAngles} pc
                                    </strong>
                                  </li>
                                </>
                              )}

                              {/* --- GONDOLA SPECIFIC (NEW) --- */}
                              {isGondola &&
                                (() => {
                                  const mult = item.dimensions.isDoubleSided
                                    ? 2
                                    : 1;
                                  const bayLen = item.bays[0];
                                  const totalGondolaPlates =
                                    item.shelvesPerRack * mult * item.qty;
                                  const totalGondolaBrackets =
                                    totalGondolaPlates * 2;

                                  return (
                                    <>
                                      <li className="flex justify-between">
                                        <span>
                                          {item.dimensions.height}ft Stands (
                                          {item.dimensions.isDoubleSided
                                            ? "Double"
                                            : "Single"}
                                          )
                                        </span>
                                        <strong className="text-gray-800">
                                          {2 * item.qty} pc
                                        </strong>
                                      </li>
                                      <li className="flex justify-between">
                                        <span>
                                          {bayLen}ft Bottom Base Decks
                                        </span>
                                        <strong className="text-gray-800">
                                          {mult * item.qty} pc
                                        </strong>
                                      </li>
                                      <li className="flex justify-between">
                                        <span>
                                          {bayLen}ft x {item.dimensions.breadth}
                                          " Plates ({item.dimensions.plateGauge}
                                          G)
                                        </span>
                                        <strong className="text-gray-800">
                                          {totalGondolaPlates} pc
                                        </strong>
                                      </li>
                                      <li className="flex justify-between">
                                        <span>
                                          {
                                            WALL_BRACKET_MAP[
                                              item.dimensions.breadth
                                            ]
                                          }
                                          " Brackets
                                        </span>
                                        <strong className="text-gray-800">
                                          {totalGondolaBrackets} pc
                                        </strong>
                                      </li>
                                      <li className="flex justify-between">
                                        <span>
                                          {bayLen}ft x {item.dimensions.height}
                                          ft Cladding
                                        </span>
                                        <strong className="text-gray-800">
                                          {mult * item.qty} pc
                                        </strong>
                                      </li>
                                      {item.dimensions.hasStopper && (
                                        <li className="flex justify-between">
                                          <span>{bayLen}ft Front Stoppers</span>
                                          <strong className="text-gray-800">
                                            {totalGondolaPlates} pc
                                          </strong>
                                        </li>
                                      )}
                                      <li className="flex justify-between">
                                        <span>Rubber Buffers</span>
                                        <strong className="text-gray-800">
                                          {4 * item.qty} pc
                                        </strong>
                                      </li>
                                    </>
                                  );
                                })()}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* EDITABLE MATERIALS BLOCK */}
          {quote && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-gray-600" /> Required
                  Materials
                </h2>
                {quote.hasOverrides && (
                  <button
                    onClick={() => setOverrides({})}
                    className="text-xs flex items-center gap-1 text-orange-600 hover:text-orange-500 font-medium bg-orange-100 px-2 py-1 rounded"
                  >
                    <RefreshCcw className="w-3 h-3" /> Reset Edits
                  </button>
                )}
              </div>

              <div className="p-4 space-y-6 max-h-[400px] overflow-y-auto">
                {/* --- SLOTTED ANGLE EDITOR --- */}
                {quote.slotted.hasItems && (
                  <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/30">
                    <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-3">
                      Slotted Angle Parts
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {[...quote.slotted.plates, ...quote.slotted.angles].map(
                        (item, idx) => (
                          <li
                            key={`es-${idx}`}
                            className="flex justify-between items-center"
                          >
                            <span className="text-gray-700 text-xs truncate pr-2">
                              {item.label}
                            </span>
                            <input
                              type="number"
                              min="0"
                              value={item.qty}
                              onChange={(e) =>
                                handleOverrideChange(item.label, e.target.value)
                              }
                              className={`w-16 bg-white border rounded p-1 text-right focus:ring-1 focus:ring-blue-500 outline-none ${overrides[item.label] !== undefined ? "border-orange-400 text-orange-600 font-bold bg-orange-50" : "border-gray-300 text-gray-800"}`}
                            />
                          </li>
                        ),
                      )}
                      <div className="border-t border-blue-100 my-2"></div>
                      <li className="flex justify-between items-center">
                        <span className="text-gray-700 text-xs">Nut/Bolts</span>
                        <input
                          type="number"
                          min="0"
                          value={quote.slotted.bolts}
                          onChange={(e) =>
                            handleOverrideChange("slottedBolts", e.target.value)
                          }
                          className={`w-16 bg-white border rounded p-1 text-right focus:ring-1 focus:ring-blue-500 outline-none ${overrides.slottedBolts !== undefined ? "border-orange-400 text-orange-600 font-bold" : "border-gray-300 text-gray-800"}`}
                        />
                      </li>
                      <li className="flex justify-between items-center">
                        <span className="text-gray-700 text-xs">
                          Corner Supports
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={quote.slotted.corners}
                          onChange={(e) =>
                            handleOverrideChange(
                              "slottedCorners",
                              e.target.value,
                            )
                          }
                          className={`w-16 bg-white border rounded p-1 text-right focus:ring-1 focus:ring-blue-500 outline-none ${overrides.slottedCorners !== undefined ? "border-orange-400 text-orange-600 font-bold" : "border-gray-300 text-gray-800"}`}
                        />
                      </li>
                      <li className="flex justify-between items-center">
                        <span className="text-gray-700 text-xs">
                          Rubber Bushes
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={quote.slotted.bushes}
                          onChange={(e) =>
                            handleOverrideChange(
                              "slottedBushes",
                              e.target.value,
                            )
                          }
                          className={`w-16 bg-white border rounded p-1 text-right focus:ring-1 focus:ring-blue-500 outline-none ${overrides.slottedBushes !== undefined ? "border-orange-400 text-orange-600 font-bold" : "border-gray-300 text-gray-800"}`}
                        />
                      </li>
                    </ul>
                  </div>
                )}

                {/* --- PIGEON HOLE EDITOR --- */}
                {quote.pigeon && quote.pigeon.hasItems && (
                  <div className="border border-orange-100 rounded-lg p-3 bg-orange-50/30 mt-4">
                    <h3 className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-3">
                      Pigeon Hole Parts
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {[
                        ...quote.pigeon.plates,
                        ...quote.pigeon.angles,
                        ...quote.pigeon.cladding,
                        ...quote.pigeon.dividers,
                        ...quote.pigeon.stoppers,
                      ].map((item, idx) => (
                        <li
                          key={`ep-${idx}`}
                          className="flex justify-between items-center"
                        >
                          <span className="text-gray-700 text-xs truncate pr-2">
                            {item.label}
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={item.qty}
                            onChange={(e) =>
                              handleOverrideChange(item.label, e.target.value)
                            }
                            className={`w-16 bg-white border rounded p-1 text-right focus:ring-1 focus:ring-orange-500 outline-none ${overrides[item.label] !== undefined ? "border-orange-400 text-orange-600 font-bold bg-orange-50" : "border-gray-300 text-gray-800"}`}
                          />
                        </li>
                      ))}
                      <div className="border-t border-orange-200 my-2"></div>
                      <li className="flex justify-between items-center">
                        <span className="text-gray-700 text-xs">Nut/Bolts</span>
                        <input
                          type="number"
                          min="0"
                          value={quote.pigeon.bolts}
                          onChange={(e) =>
                            handleOverrideChange("pigeonBolts", e.target.value)
                          }
                          className={`w-16 bg-white border rounded p-1 text-right focus:ring-1 focus:ring-orange-500 outline-none ${overrides.pigeonBolts !== undefined ? "border-orange-400 text-orange-600 font-bold" : "border-gray-300 text-gray-800"}`}
                        />
                      </li>
                      <li className="flex justify-between items-center">
                        <span className="text-gray-700 text-xs">
                          Corner Supports
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={quote.pigeon.corners}
                          onChange={(e) =>
                            handleOverrideChange(
                              "pigeonCorners",
                              e.target.value,
                            )
                          }
                          className={`w-16 bg-white border rounded p-1 text-right focus:ring-1 focus:ring-orange-500 outline-none ${overrides.pigeonCorners !== undefined ? "border-orange-400 text-orange-600 font-bold" : "border-gray-300 text-gray-800"}`}
                        />
                      </li>
                      <li className="flex justify-between items-center">
                        <span className="text-gray-700 text-xs">
                          Rubber Bushes
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={quote.pigeon.bushes}
                          onChange={(e) =>
                            handleOverrideChange("pigeonBushes", e.target.value)
                          }
                          className={`w-16 bg-white border rounded p-1 text-right focus:ring-1 focus:ring-orange-500 outline-none ${overrides.pigeonBushes !== undefined ? "border-orange-400 text-orange-600 font-bold" : "border-gray-300 text-gray-800"}`}
                        />
                      </li>
                    </ul>
                  </div>
                )}

                {/* --- GONDOLA EDITOR --- */}
                {quote.gondola && quote.gondola.hasItems && (
                  <div className="border border-teal-100 rounded-lg p-3 bg-teal-50/30 mt-4">
                    <h3 className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-3">
                      Gondola Parts
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {[
                        ...quote.gondola.stands,
                        ...quote.gondola.bottoms,
                        ...quote.gondola.plates,
                        ...quote.gondola.brackets,
                        ...quote.gondola.cladding,
                        ...quote.gondola.stoppers,
                      ].map((item, idx) => (
                        <li
                          key={`eg-${idx}`}
                          className="flex justify-between items-center"
                        >
                          <span className="text-gray-700 text-xs truncate pr-2">
                            {item.label}
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={item.qty}
                            onChange={(e) =>
                              handleOverrideChange(item.label, e.target.value)
                            }
                            className={`w-16 bg-white border rounded p-1 text-right focus:ring-1 focus:ring-teal-500 outline-none ${overrides[item.label] !== undefined ? "border-orange-400 text-orange-600 font-bold bg-orange-50" : "border-gray-300 text-gray-800"}`}
                          />
                        </li>
                      ))}
                      <div className="border-t border-teal-200 my-2"></div>
                      <li className="flex justify-between items-center">
                        <span className="text-gray-700 text-xs">
                          Rubber Buffers
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={quote.gondola.buffers}
                          onChange={(e) =>
                            handleOverrideChange(
                              "gondolaBuffers",
                              e.target.value,
                            )
                          }
                          className={`w-16 bg-white border rounded p-1 text-right focus:ring-1 focus:ring-teal-500 outline-none ${overrides.gondolaBuffers !== undefined ? "border-orange-400 text-orange-600 font-bold" : "border-gray-300 text-gray-800"}`}
                        />
                      </li>
                    </ul>
                  </div>
                )}

                {/* --- WALL MOUNTED EDITOR --- */}
                {quote.wall.hasItems && (
                  <div className="border border-indigo-100 rounded-lg p-3 bg-indigo-50/30 mt-4">
                    <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-3">
                      Wall Mounted Parts
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {[
                        ...quote.wall.plates,
                        ...quote.wall.channels,
                        ...quote.wall.brackets,
                        ...quote.wall.stoppers,
                      ].map((item, idx) => (
                        <li
                          key={`ew-${idx}`}
                          className="flex justify-between items-center"
                        >
                          <span className="text-gray-700 text-xs truncate pr-2">
                            {item.label}
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={item.qty}
                            onChange={(e) =>
                              handleOverrideChange(item.label, e.target.value)
                            }
                            className={`w-16 bg-white border rounded p-1 text-right focus:ring-1 focus:ring-indigo-500 outline-none ${overrides[item.label] !== undefined ? "border-orange-400 text-orange-600 font-bold bg-orange-50" : "border-gray-300 text-gray-800"}`}
                          />
                        </li>
                      ))}
                      <div className="border-t border-indigo-100 my-2"></div>
                      <li className="flex justify-between items-center">
                        <span className="text-gray-700 text-xs">Screws</span>
                        <input
                          type="number"
                          min="0"
                          value={quote.wall.screws}
                          onChange={(e) =>
                            handleOverrideChange("wallScrews", e.target.value)
                          }
                          className={`w-16 bg-white border rounded p-1 text-right focus:ring-1 focus:ring-indigo-500 outline-none ${overrides.wallScrews !== undefined ? "border-orange-400 text-orange-600 font-bold" : "border-gray-300 text-gray-800"}`}
                        />
                      </li>
                    </ul>
                  </div>
                )}

                {/* --- CHARGES EDITOR --- */}
                <div className="pt-2 border-t border-gray-200">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                    <Truck className="w-3 h-3" /> Service & Logistics
                  </h3>
                  <ul className="space-y-3 text-sm">
                    {/* NEW TOGGLE SWITCH */}
                    <li className="flex justify-between items-center bg-gray-100 p-2 rounded-lg border border-gray-200">
                      <span className="text-gray-700 font-bold text-xs">
                        Fitting
                      </span>
                      <button
                        onClick={() => setIsFittingOpted(!isFittingOpted)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isFittingOpted ? "bg-green-500" : "bg-gray-300"}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isFittingOpted ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                    </li>

                    {/* ONLY SHOW RATES IF FITTING IS OPTED IN */}
                    {isFittingOpted && quote.slotted.hasItems && (
                      <li className="flex justify-between items-center pl-2 animate-in fade-in">
                        <span className="text-gray-600 text-xs">
                          Slotted Rack Fitting (per plate)
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500 font-medium">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={slottedFittingRate}
                            onChange={(e) =>
                              setSlottedFittingRate(e.target.value)
                            }
                            className="w-16 bg-white border border-gray-300 rounded p-1 text-right focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </li>
                    )}
                    {isFittingOpted && quote.wall.hasItems && (
                      <li className="flex justify-between items-center pl-2 animate-in fade-in">
                        <span className="text-gray-600 text-xs">
                          Wall Rack Fitting (per channel)
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500 font-medium">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={wallFittingRate}
                            onChange={(e) => setWallFittingRate(e.target.value)}
                            className="w-16 bg-white border border-gray-300 rounded p-1 text-right focus:ring-1 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </li>
                    )}
                    {/* Pigeon Fitting Input */}
                    {isFittingOpted &&
                      quote.pigeon &&
                      quote.pigeon.hasItems && (
                        <li className="flex justify-between items-center pl-2 animate-in fade-in">
                          <span className="text-gray-600 text-xs">
                            Pigeon Rack Fitting (per part)
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 font-medium">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={pigeonFittingRate}
                              onChange={(e) =>
                                setPigeonFittingRate(e.target.value)
                              }
                              className="w-16 bg-white border border-gray-300 rounded p-1 text-right focus:ring-1 focus:ring-orange-500 outline-none"
                            />
                          </div>
                        </li>
                      )}
                    {/* Gondola Fitting Input (Manual Total) */}
                    {isFittingOpted &&
                      quote.gondola &&
                      quote.gondola.hasItems && (
                        <li className="flex justify-between items-center pl-2 animate-in fade-in">
                          <span className="text-gray-600 text-xs">
                            Gondola Rack Fitting (Total)
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 font-medium">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={gondolaFittingCharge}
                              onChange={(e) =>
                                setGondolaFittingCharge(e.target.value)
                              }
                              className="w-16 bg-white border border-gray-300 rounded p-1 text-right focus:ring-1 focus:ring-teal-500 outline-none"
                            />
                          </div>
                        </li>
                      )}

                    <li className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="text-gray-700 text-xs font-bold">
                        Rickshaw Rent (Fixed)
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500 font-medium">₹</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={rickshawRent}
                          onChange={(e) => setRickshawRent(e.target.value)}
                          className="w-16 bg-white border border-gray-300 rounded p-1 text-right focus:ring-1 focus:ring-gray-500 outline-none placeholder-gray-300"
                        />
                      </div>
                    </li>
                  </ul>
                  {/* NEW MARKUP TOGGLE */}
                  <li className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-gray-700 text-xs font-bold text-teal-700">
                      Add 9%
                    </span>
                    <button
                      onClick={() => setApplyMarkup(!applyMarkup)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${applyMarkup ? "bg-teal-500" : "bg-gray-300"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${applyMarkup ? "translate-x-6" : "translate-x-1"}`}
                      />
                    </button>
                  </li>
                </div>
                {/* --- REMARKS / NOTES EDITOR --- */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden mt-6">
                  <div className="absolute top-0 left-0 w-1 h-full bg-teal-500"></div>
                  <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-teal-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      ></path>
                    </svg>
                    Remarks / Notes
                  </h2>
                  <textarea
                    value={quotationNote}
                    onChange={(e) => setQuotationNote(e.target.value)}
                    placeholder="Add terms, delivery timelines, or special instructions..."
                    className="w-full border-gray-300 rounded-lg shadow-sm p-3 border focus:ring-1 focus:ring-teal-500 outline-none text-sm min-h-[80px] resize-y text-gray-700"
                  />
                </div>
              </div>
            </div>
          )}

          {/* --- FINAL QUOTATION SNAPSHOT TARGET --- */}
          <div
            ref={quoteRef}
            className="bg-gray-900 text-white rounded-xl shadow-xl p-8 relative overflow-hidden border border-gray-800"
          >
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  VARUN Enterprise
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Material Estimate & Schematics
                </p>
              </div>
              <LayoutGrid className="text-gray-500 w-8 h-8 opacity-50" />
            </div>

            {!quote ? (
              <div className="text-gray-500 text-center py-6 text-sm">
                Awaiting items...
              </div>
            ) : (
              <div className="space-y-6">
                {/* SCHEMATICS */}
                <h3 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">
                  Structural Schematics
                </h3>
                <div className="grid grid-cols-1 gap-4 mb-8">
                  {quote.enrichedCart.map(
                    (item, idx) =>
                      !item.isCustomPart && (
                        <div
                          key={`schema-${idx}`}
                          className="flex flex-col gap-2"
                        >
                          <RackSchematic item={item} />
                          {item.qty > 1 && (
                            <p className="text-center text-sm font-bold text-gray-400 mt-1">
                              x {item.qty} Units
                            </p>
                          )}
                        </div>
                      ),
                  )}
                </div>

                <h3 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3 border-t border-gray-700 pt-6">
                  Itemized Specification
                </h3>
                <ul className="space-y-2 text-[14px] text-gray-200">
                  {/* PRINT SLOTTED PARTS */}
                  {quote.slotted.hasItems && (
                    <>
                      <li className="text-blue-400 text-xs font-bold uppercase mt-4 mb-1 border-b border-gray-700 pb-1">
                        Slotted Angle Rack
                      </li>
                      {quote.slotted.plates
                        .filter((i) => i.qty > 0)
                        .map((item, idx) => (
                          <li
                            key={`qp-${idx}`}
                            className="flex  sm:flex-row justify-between items-start sm:items-end border-b border-gray-800/50 pb-2 sm:pb-1 gap-1"
                          >
                            {/* 1. Label part - wraps naturally */}
                            <span className="pr-2 text-gray-200 flex-1 leading-tight">
                              {item.label.includes(" - ") ? (
                                <>
                                  {item.label.split(" - ")[0]}
                                  <span className="block text-[10px] text-blue-400 font-bold italic">
                                    — {item.label.split(" - ")[1]}
                                  </span>
                                </>
                              ) : (
                                item.label
                              )}
                            </span>

                            {/* 2. Calculation part - stays together */}
                            <span className="font-mono text-xs whitespace-nowrap self-end">
                              <span className="text-gray-400">
                                {item.qty}pc * ₹{item.unitPrice} ={" "}
                              </span>
                              <strong className="text-white inline-block w-16 text-right">
                                ₹{item.total}
                              </strong>
                            </span>
                          </li>
                        ))}
                      {quote.slotted.angles
                        .filter((i) => i.qty > 0)
                        .map((item, idx) => (
                          <li
                            key={`qp-${idx}`}
                            className="flex sm:flex-row justify-between items-start sm:items-end border-b border-gray-800/50 pb-2 sm:pb-1 gap-1"
                          >
                            {/* 1. Label part - wraps naturally */}
                            <span className="pr-2 text-gray-200 flex-1 leading-tight">
                              {item.label.includes(" - ") ? (
                                <>
                                  {item.label.split(" - ")[0]}
                                  <span className="block text-[10px] text-blue-400 font-bold italic">
                                    — {item.label.split(" - ")[1]}
                                  </span>
                                </>
                              ) : (
                                item.label
                              )}
                            </span>

                            {/* 2. Calculation part - stays together */}
                            <span className="font-mono text-xs whitespace-nowrap self-end">
                              <span className="text-gray-400">
                                {item.qty}pc * ₹{item.unitPrice} ={" "}
                              </span>
                              <strong className="text-white inline-block w-16 text-right">
                                ₹{item.total}
                              </strong>
                            </span>
                          </li>
                        ))}
                      {quote.slotted.bolts > 0 && (
                        <li className="flex justify-between items-end border-b border-gray-800/50 pb-1">
                          <span className="pr-4">Nut/Bolts</span>
                          <span className="font-mono text-xs whitespace-nowrap self-end">
                            <span className="text-gray-400">
                              {quote.slotted.bolts}pc * ₹
                              {quote.hardwarePrices.bolt} ={" "}
                            </span>
                            <strong className="text-white inline-block w-16 text-right">
                              ₹{quote.slotted.bolts * quote.hardwarePrices.bolt}
                            </strong>
                          </span>
                        </li>
                      )}
                      {quote.slotted.corners > 0 && (
                        <li className="flex justify-between items-end border-b border-gray-800/50 pb-1">
                          <span className="pr-4">Corner Supports</span>
                          <span className="font-mono text-xs whitespace-nowrap self-end">
                            <span className="text-gray-400">
                              {quote.slotted.corners}pc * ₹
                              {quote.hardwarePrices.corner} ={" "}
                            </span>
                            <strong className="text-white inline-block w-16 text-right">
                              ₹
                              {quote.slotted.corners *
                                quote.hardwarePrices.corner}
                            </strong>
                          </span>
                        </li>
                      )}
                      {quote.slotted.bushes > 0 && (
                        <li className="flex justify-between items-end border-b border-gray-800/50 pb-1">
                          <span className="pr-4">Rubber Bushes</span>
                          <span className="font-mono text-xs whitespace-nowrap self-end">
                            <span className="text-gray-400">
                              {quote.slotted.bushes}pc * ₹
                              {quote.hardwarePrices.bush} ={" "}
                            </span>
                            <strong className="text-white inline-block w-16 text-right">
                              ₹
                              {quote.slotted.bushes * quote.hardwarePrices.bush}
                            </strong>
                          </span>
                        </li>
                      )}
                    </>
                  )}

                  {/* PRINT PIGEON PARTS */}
                  {quote.pigeon && quote.pigeon.hasItems && (
                    <>
                      <li className="text-orange-400 text-xs font-bold uppercase mt-4 mb-1 border-b border-gray-700 pb-1">
                        Pigeon Hole Rack
                      </li>
                      {[
                        ...quote.pigeon.plates,
                        ...quote.pigeon.angles,
                        ...quote.pigeon.cladding,
                        ...quote.pigeon.dividers,
                        ...quote.pigeon.stoppers,
                      ]
                        .filter((i) => i.qty > 0)
                        .map((item, idx) => (
                          <li
                            key={`pig-${idx}`}
                            className="flex justify-between items-end border-b border-gray-800/50 pb-1"
                          >
                            <span className="pr-4 text-gray-200">
                              {item.label}
                            </span>
                            <span className="font-mono text-xs whitespace-nowrap self-end">
                              <span className="text-gray-400">
                                {item.qty} * ₹{item.unitPrice} ={" "}
                              </span>
                              <strong className="text-white inline-block w-16 text-right">
                                ₹{item.total}
                              </strong>
                            </span>
                          </li>
                        ))}
                      {quote.pigeon.bolts > 0 && (
                        <li className="flex justify-between items-end border-b border-gray-800/50 pb-1">
                          <span className="pr-4 text-gray-200">Nut/Bolts</span>
                          <span className="font-mono text-xs whitespace-nowrap self-end">
                            <span className="text-gray-400">
                              {quote.pigeon.bolts}pc * ₹
                              {quote.hardwarePrices.bolt} ={" "}
                            </span>
                            <strong className="text-white inline-block w-16 text-right">
                              ₹{quote.pigeon.bolts * quote.hardwarePrices.bolt}
                            </strong>
                          </span>
                        </li>
                      )}
                      {quote.pigeon.corners > 0 && (
                        <li className="flex justify-between items-end border-b border-gray-800/50 pb-1">
                          <span className="pr-4 text-gray-200">
                            Corner Supports
                          </span>
                          <span className="font-mono text-xs whitespace-nowrap self-end">
                            <span className="text-gray-400">
                              {quote.pigeon.corners}pc * ₹
                              {quote.hardwarePrices.corner} ={" "}
                            </span>
                            <strong className="text-white inline-block w-16 text-right">
                              ₹
                              {quote.pigeon.corners *
                                quote.hardwarePrices.corner}
                            </strong>
                          </span>
                        </li>
                      )}
                      {quote.pigeon.bushes > 0 && (
                        <li className="flex justify-between items-end border-b border-gray-800/50 pb-1">
                          <span className="pr-4 text-gray-200">
                            Rubber Bushes
                          </span>
                          <span className="font-mono text-xs whitespace-nowrap self-end">
                            <span className="text-gray-400">
                              {quote.pigeon.bushes}pc * ₹
                              {quote.hardwarePrices.bush} ={" "}
                            </span>
                            <strong className="text-white inline-block w-16 text-right">
                              ₹{quote.pigeon.bushes * quote.hardwarePrices.bush}
                            </strong>
                          </span>
                        </li>
                      )}
                    </>
                  )}

                  {/* PRINT GONDOLA PARTS */}
                  {quote.gondola && quote.gondola.hasItems && (
                    <>
                      <li className="text-teal-400 text-xs font-bold uppercase mt-4 mb-1 border-b border-gray-700 pb-1">
                        Gondola Rack
                      </li>
                      {[
                        ...quote.gondola.stands,
                        ...quote.gondola.bottoms,
                        ...quote.gondola.plates,
                        ...quote.gondola.brackets,
                        ...quote.gondola.cladding,
                        ...quote.gondola.stoppers,
                      ]
                        .filter((i) => i.qty > 0)
                        .map((item, idx) => (
                          <li
                            key={`gond-${idx}`}
                            className="flex justify-between items-end border-b border-gray-800/50 pb-1"
                          >
                            <span className="pr-4 text-gray-200">
                              {item.label}
                            </span>
                            <span className="font-mono text-xs whitespace-nowrap self-end">
                              <span className="text-gray-400">
                                {item.qty} * ₹{item.unitPrice} ={" "}
                              </span>
                              <strong className="text-white inline-block w-16 text-right">
                                ₹{item.total}
                              </strong>
                            </span>
                          </li>
                        ))}
                      {quote.gondola.buffers > 0 && (
                        <li className="flex justify-between items-end border-b border-gray-800/50 pb-1">
                          <span className="pr-4 text-gray-200">
                            Rubber Buffers
                          </span>
                          <span className="font-mono text-xs whitespace-nowrap self-end">
                            <span className="text-gray-400">
                              {quote.gondola.buffers}pc * ₹
                              {quote.hardwarePrices.buffer} ={" "}
                            </span>
                            <strong className="text-white inline-block w-16 text-right">
                              ₹
                              {quote.gondola.buffers *
                                quote.hardwarePrices.buffer}
                            </strong>
                          </span>
                        </li>
                      )}
                    </>
                  )}

                  {/* PRINT WALL MOUNTED PARTS */}
                  {quote.wall.hasItems && (
                    <>
                      <li className="text-indigo-400 text-xs font-bold uppercase mt-4 mb-1 border-b border-gray-700 pb-1">
                        Wall Mounted Rack
                      </li>
                      {quote.wall.plates
                        .filter((i) => i.qty > 0)
                        .map((item, idx) => (
                          <li
                            key={`wp-${idx}`}
                            className="flex justify-between items-end border-b border-gray-800/50 pb-1"
                          >
                            <span className="pr-4">{item.label}</span>
                            <span className="font-mono text-xs whitespace-nowrap self-end">
                              <span className="text-gray-400">
                                {item.qty}pc * ₹{item.unitPrice} ={" "}
                              </span>
                              <strong className="text-white inline-block w-16 text-right">
                                ₹{item.total}
                              </strong>
                            </span>
                          </li>
                        ))}
                      {quote.wall.channels
                        .filter((i) => i.qty > 0)
                        .map((item, idx) => (
                          <li
                            key={`wc-${idx}`}
                            className="flex justify-between items-end border-b border-gray-800/50 pb-1"
                          >
                            <span className="pr-4">{item.label}</span>
                            <span className="font-mono text-xs whitespace-nowrap self-end">
                              <span className="text-gray-400">
                                {item.qty}pc * ₹{item.unitPrice} ={" "}
                              </span>
                              <strong className="text-white inline-block w-16 text-right">
                                ₹{item.total}
                              </strong>
                            </span>
                          </li>
                        ))}
                      {quote.wall.brackets
                        .filter((i) => i.qty > 0)
                        .map((item, idx) => (
                          <li
                            key={`wb-${idx}`}
                            className="flex justify-between items-end border-b border-gray-800/50 pb-1"
                          >
                            <span className="pr-4">{item.label}</span>
                            <span className="font-mono text-xs whitespace-nowrap self-end">
                              <span className="text-gray-400">
                                {item.qty}pc * ₹{item.unitPrice} ={" "}
                              </span>
                              <strong className="text-white inline-block w-16 text-right">
                                ₹{item.total}
                              </strong>
                            </span>
                          </li>
                        ))}
                      {quote.wall.stoppers
                        .filter((i) => i.qty > 0)
                        .map((item, idx) => (
                          <li
                            key={`ws-${idx}`}
                            className="flex justify-between items-end border-b border-gray-800/50 pb-1"
                          >
                            <span className="pr-4">{item.label}</span>
                            <span className="font-mono text-xs whitespace-nowrap self-end">
                              <span className="text-gray-400">
                                {item.qty}pc * ₹{item.unitPrice} ={" "}
                              </span>
                              <strong className="text-white inline-block w-16 text-right">
                                ₹{item.total}
                              </strong>
                            </span>
                          </li>
                        ))}
                      {quote.wall.screws > 0 && (
                        <li className="flex justify-between items-end border-b border-gray-800/50 pb-1">
                          <span className="pr-4">Screws</span>
                          <span className="font-mono text-xs">
                            <span className="text-gray-400">
                              {quote.wall.screws}pc * ₹
                              {quote.hardwarePrices.screw} ={" "}
                            </span>
                            <strong className="text-white inline-block w-16 text-right">
                              ₹{quote.wall.screws * quote.hardwarePrices.screw}
                            </strong>
                          </span>
                        </li>
                      )}
                    </>
                  )}

                  {/* PRINT CHARGES */}
                  {(quote.charges.sFittingCost > 0 ||
                    quote.charges.wFittingCost > 0 ||
                    quote.charges.pFittingCost > 0 ||
                    quote.charges.gFittingCost > 0 ||
                    quote.charges.rentCost > 0) && (
                    <>
                      <li className="text-gray-400 text-xs font-bold uppercase mt-4 mb-1 border-b border-gray-700 pb-1">
                        Service & Logistics
                      </li>
                      {quote.charges.sFittingCost > 0 && (
                        <li className="flex justify-between items-end border-b border-gray-800/50 pb-1 text-gray-300">
                          <span className="pr-4 text-xs">Slotted Fitting</span>
                          <span className="font-mono text-xs whitespace-nowrap self-end">
                            <span className="text-gray-500">
                              {quote.charges.totalSlottedPlates} plate * ₹
                              {quote.charges.sFittingRate} ={" "}
                            </span>
                            <strong className="text-white inline-block w-16 text-right">
                              ₹{quote.charges.sFittingCost}
                            </strong>
                          </span>
                        </li>
                      )}
                      {quote.charges.wFittingCost > 0 && (
                        <li className="flex justify-between items-end border-b border-gray-800/50 pb-1 text-gray-300">
                          <span className="pr-4 text-xs">Wall Fitting</span>
                          <span className="font-mono text-xs whitespace-nowrap self-end">
                            <span className="text-gray-500">
                              {quote.charges.totalWallChannels} ch. * ₹
                              {quote.charges.wFittingRate} ={" "}
                            </span>
                            <strong className="text-white inline-block w-16 text-right">
                              ₹{quote.charges.wFittingCost}
                            </strong>
                          </span>
                        </li>
                      )}
                      {/* Pigeon Fitting Output */}
                      {quote.charges.pFittingCost > 0 && (
                        <li className="flex justify-between items-end border-b border-gray-800/50 pb-1 text-gray-300">
                          <span className="pr-4 text-xs">
                            Pigeon Rack Fitting
                          </span>
                          <span className="font-mono text-xs whitespace-nowrap self-end">
                            <strong className="text-white inline-block w-16 text-right">
                              ₹{quote.charges.pFittingCost}
                            </strong>
                          </span>
                        </li>
                      )}
                      {/* Gondola Fitting Output */}
                      {quote.charges.gFittingCost > 0 && (
                        <li className="flex justify-between items-end border-b border-gray-800/50 pb-1 text-gray-300">
                          <span className="pr-4 text-xs">Gondola Fitting</span>
                          <span className="font-mono text-xs whitespace-nowrap self-end">
                            <strong className="text-white inline-block w-16 text-right">
                              ₹{quote.charges.gFittingCost}
                            </strong>
                          </span>
                        </li>
                      )}
                      {quote.charges.rentCost > 0 && (
                        <li className="flex justify-between items-end border-b border-gray-800/50 pb-1 text-gray-300">
                          <span className="pr-4 text-xs">Rickshaw Rent</span>
                          <span className="font-mono text-xs whitespace-nowrap self-end">
                            <strong className="text-white inline-block w-16 text-right">
                              ₹{quote.charges.rentCost}
                            </strong>
                          </span>
                        </li>
                      )}
                    </>
                  )}
                </ul>

                <div className="pt-2 mt-6">
                  <div className="flex justify-between items-end bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <span className="text-lg font-medium text-gray-300">
                      Grand Total:
                    </span>
                    <span className="text-3xl font-bold text-green-400">
                      ₹
                      {quote.grandTotal.toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                </div>
                {/* PRINT REMARKS / NOTES */}
                {quotationNote?.trim() && (
                  <div className="mt-8">
                    <div className="relative border-t border-gray-700/60 pt-6">
                      {/* Section Label */}
                      <h4 className="absolute -top-2 left-0 bg-gray-900 px-3 text-[11px] font-semibold tracking-[0.14em] text-gray-400 uppercase">
                        Instructions
                      </h4>

                      {/* Premium Content */}
                      <div className="mt-3 bg-gray-800/40 border border-gray-700/50 rounded-lg px-4 py-4 backdrop-blur-sm">
                        <p className="text-[15px] text-gray-200 leading-7 whitespace-pre-wrap font-light tracking-[0.01em]">
                          {quotationNote}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {quote && (
            <div className="mt-6 space-y-4">
              {/* CUSTOMER INFO BLOCK */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Customer Mobile Number
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 font-bold">
                      +91
                    </span>
                    <input
                      type="tel"
                      placeholder="9876543210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-lg font-medium"
                      maxLength={10}
                    />
                  </div>

                  {/* DIRECT WHATSAPP BUTTON */}
                  <button
                    onClick={handleWhatsAppShare}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51h-.57c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    Send WhatsApp
                  </button>
                </div>
              </div>

              {/* ORIGINAL SHARE BUTTON */}
              <button
                onClick={handleShareSnapshot}
                disabled={isCapturing}
                className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-75 text-white font-bold py-3.5 rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2 text-lg"
              >
                <Share2 className="w-5 h-5" />{" "}
                {isCapturing ? "Generating Image..." : "Share Quotation"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RackConfigurator;
