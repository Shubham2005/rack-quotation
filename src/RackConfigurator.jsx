import React, { useState, useMemo, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
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
import { calculateQuote, getPricingDim } from "./utils/quoteEngine";
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
  const [buildMode, setBuildMode] = useState("mixed");
  const [mixedBays, setMixedBays] = useState([]);
  const [mixedShelves, setMixedShelves] = useState(5);
  const [customItem, setCustomItem] = useState({ category: "plates", qty: 1 });
  const [gondolaMixedBays, setGondolaMixedBays] = useState([]);

  // Slotted Dimensions
  const [slottedDims, setSlottedDims] = useState({
    length: "3",
    customLength: "",
    breadth: "12",
    customBreadth: "",
    height: "6",
    customHeight: "",
    plateGauge: 22,
    angleGauge: 16,
    plateColor: "standard",
    angleColor: "standard",
  });

  // Wall Dimensions
  const [wallDims, setWallDims] = useState({
    length: "35.5",
    customLength: "",
    breadth: "9.25",
    customBreadth: "",
    height: "6",
    customHeight: "",
    plateGauge: "22",
    hasStopper: false,
    useCustomBreadths: false,
    customBreadths: Array(5).fill("9.25"),
  });

  // Gondola Dimensions
  const [gondolaDims, setGondolaDims] = useState({
    length: "3", // 3ft or 4ft standalone
    customLength: "",
    height: "6", // 4, 5, 6, 7
    customHeight: "",
    breadth: "12.25",
    customBreadth: "",
    shelves: 4,
    plateGauge: "22",
    hasStopper: false,
    isDoubleSided: false,
    useCustomBreadths: false,
    customBreadths: Array(4).fill("12.25"),
  });

  // Pigeon Dimensions
  const [pigeonDims, setPigeonDims] = useState({
    length: "3",
    customLength: "",
    breadth: "12",
    customBreadth: "",
    height: "6",
    customHeight: "",
    rows: 4,
    columns: 3,
    plateGauge: 22,
    angleGauge: 16,
    hasStopper: true,
    useCustomColumns: false,
    customColumns: [3, 3, 3],
  });

  const handlePigeonRowsChange = (newRows) => {
    const rowsVal = newRows === "" ? "" : parseInt(newRows) || 0;
    setPigeonDims((prev) => {
      const calcRows = rowsVal === "" ? 4 : Math.max(2, rowsVal);
      const neededSpaces = Math.max(1, calcRows - 1);
      let newCustomColumns = [...(prev.customColumns || [])];

      if (newCustomColumns.length < neededSpaces) {
        const diff = neededSpaces - newCustomColumns.length;
        for (let i = 0; i < diff; i++) {
          newCustomColumns.push(prev.columns || 3);
        }
      } else if (newCustomColumns.length > neededSpaces) {
        newCustomColumns = newCustomColumns.slice(0, neededSpaces);
      }

      return {
        ...prev,
        rows: rowsVal,
        customColumns: newCustomColumns,
      };
    });
  };

  const handlePigeonColumnsChange = (newCols) => {
    const colsVal = newCols === "" ? "" : parseInt(newCols) || 0;
    setPigeonDims((prev) => {
      const calcCols = colsVal === "" ? 3 : Math.max(1, colsVal);
      const calcRows = prev.rows === "" ? 4 : Math.max(2, prev.rows);
      const neededSpaces = Math.max(1, calcRows - 1);
      const newCustomColumns = Array(neededSpaces).fill(calcCols);
      return {
        ...prev,
        columns: colsVal,
        customColumns: newCustomColumns,
      };
    });
  };
  const handleGondolaShelvesChange = (newShelves) => {
    const sVal = newShelves === "" ? "" : parseInt(newShelves) || 0;
    setGondolaDims((prev) => {
      const calcShelves = sVal === "" ? 4 : Math.max(1, sVal);
      let newCustomBreadths = [...(prev.customBreadths || [])];
      let newCustomBreadthsVals = [...(prev.customBreadthsVals || [])];

      if (newCustomBreadths.length < calcShelves) {
        const diff = calcShelves - newCustomBreadths.length;
        for (let i = 0; i < diff; i++) {
          newCustomBreadths.push(prev.breadth || "12.25");
          newCustomBreadthsVals.push("10");
        }
      } else if (newCustomBreadths.length > calcShelves) {
        newCustomBreadths = newCustomBreadths.slice(0, calcShelves);
        newCustomBreadthsVals = newCustomBreadthsVals.slice(0, calcShelves);
      }

      return {
        ...prev,
        shelves: sVal,
        customBreadths: newCustomBreadths,
        customBreadthsVals: newCustomBreadthsVals,
      };
    });
  };

  const handleWallShelvesChange = (newShelves) => {
    const sVal = newShelves === "" ? "" : parseInt(newShelves) || 0;
    setMixedShelves(sVal);
  };

  const [overrides, setOverrides] = useState({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [isWhatsappPDF, setIsWhatsappPDF] = useState(false);

  // --- CHARGES STATE ---
  const [slottedFittingRate, setSlottedFittingRate] = useState(20);
  const [wallFittingRate, setWallFittingRate] = useState(100);
  const [pigeonFittingCharge, setPigeonFittingCharge] = useState("");
  const [gondolaFittingCharge, setGondolaFittingCharge] = useState("");
  const [rickshawRent, setRickshawRent] = useState("");
  const [isFittingOpted, setIsFittingOpted] = useState(false);
  const [quotationNote, setQuotationNote] = useState("");
  const [applyMarkup, setApplyMarkup] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGst, setCustomerGst] = useState("");
  const [isFetchingGst, setIsFetchingGst] = useState(false);
  const [gstError, setGstError] = useState("");

  const quoteRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const letterheadRef = useRef(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [invoiceOverrides, setInvoiceOverrides] = useState({});
  const [isEditInvoiceMode, setIsEditInvoiceMode] = useState(false);

  // Helper function to update a specific row's label or rate
  const handleInvoiceOverride = (originalLabel, field, value) => {
    setInvoiceOverrides((prev) => ({
      ...prev,
      [originalLabel]: {
        ...prev[originalLabel],
        [field]: value,
      },
    }));
  };

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

  // Sync Wall Mounted customBreadths array length to shelves count
  useEffect(() => {
    const currentShelves =
      buildMode === "standard" ? selectedCell.y || 5 : mixedShelves || 5;
    setWallDims((prev) => {
      let newCustomBreadths = [...(prev.customBreadths || [])];
      let newCustomBreadthsVals = [...(prev.customBreadthsVals || [])];
      const calcShelves = Math.max(1, currentShelves);

      if (newCustomBreadths.length < calcShelves) {
        const diff = calcShelves - newCustomBreadths.length;
        for (let i = 0; i < diff; i++) {
          newCustomBreadths.push(prev.breadth || "9.25");
          newCustomBreadthsVals.push("10");
        }
      } else if (newCustomBreadths.length > calcShelves) {
        newCustomBreadths = newCustomBreadths.slice(0, calcShelves);
        newCustomBreadthsVals = newCustomBreadthsVals.slice(0, calcShelves);
      }

      // Only update state if length actually changed to avoid infinite loop
      if (
        prev.customBreadths?.length !== newCustomBreadths.length ||
        prev.customBreadthsVals?.length !== newCustomBreadthsVals.length
      ) {
        return {
          ...prev,
          customBreadths: newCustomBreadths,
          customBreadthsVals: newCustomBreadthsVals,
        };
      }
      return prev;
    });
  }, [selectedCell.y, mixedShelves, buildMode]);

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
      const getBayVal = () => {
        if (currentLength === "custom") {
          return {
            isCustom: true,
            val: isSlotted ? slottedDims.customLength : wallDims.customLength,
          };
        }
        return isSlotted ? parseInt(currentLength) : parseFloat(currentLength);
      };
      newBays = Array(selectedCell.x).fill(getBayVal());
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
        const pLen = getPricingDim(
          "slotted",
          "length",
          dims.length,
          dims.customLength,
        );
        const pBre = getPricingDim(
          "slotted",
          "breadth",
          dims.breadth,
          dims.customBreadth,
        );
        const displayLen =
          dims.length === "custom"
            ? `${dims.customLength}"`
            : `${dims.length}'`;
        const displayBre =
          dims.breadth === "custom"
            ? `${dims.customBreadth}"`
            : `${dims.breadth}"`;

        let pPrice =
          MOCK_PRICING.slotted.plates[`${pLen}-${pBre}`]?.[dims.plateGauge] ||
          0;
        let pLabel = `${displayLen}x${displayBre} Plate (${dims.plateGauge}G)`;

        if (dims.plateColor === "custom") {
          const surcharge =
            MOCK_PRICING.slotted.colorSurcharge.plates[`${pLen}-${pBre}`] || 0;
          pPrice += surcharge;
          pLabel += ` - Custom Color (+₹${surcharge}/pc)`;
        }

        price = pPrice;
        label = pLabel;
      } else if (category === "angles") {
        const aHeight = getPricingDim(
          "slotted",
          "height",
          dims.height,
          dims.customHeight,
        );
        const displayHeight =
          dims.height === "custom"
            ? `${dims.customHeight}"`
            : `${dims.height}ft`;

        let aPrice =
          MOCK_PRICING.slotted.angles[aHeight]?.[dims.angleGauge] || 0;
        let aLabel = `${displayHeight} Angle (${dims.angleGauge}G)`;

        if (dims.angleColor === "custom") {
          const surcharge =
            MOCK_PRICING.slotted.colorSurcharge.angles[aHeight] || 0;
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
      const wLen = getPricingDim(
        "wall",
        "length",
        dims.length,
        dims.customLength,
      );
      const wBre = getPricingDim(
        "wall",
        "breadth",
        dims.breadth,
        dims.customBreadth,
      );
      const wHeight = getPricingDim(
        "wall",
        "height",
        dims.height,
        dims.customHeight,
      );

      const displayWLen =
        dims.length === "custom" ? `${dims.customLength}"` : `${dims.length}"`;
      const displayWBre =
        dims.breadth === "custom"
          ? `${dims.customBreadth}"`
          : `${dims.breadth}"`;
      const displayWHeight =
        dims.height === "custom" ? `${dims.customHeight}"` : `${dims.height}ft`;

      if (category === "plates") {
        label = `${displayWLen}x${displayWBre} Plate (${dims.plateGauge}G)`;
        price =
          MOCK_PRICING.wall.plates[`${wLen}-${wBre}`]?.[dims.plateGauge] || 0;
      } else if (category === "channels") {
        label = `${displayWHeight} Channel`;
        price = MOCK_PRICING.wall.channels[wHeight] || 0;
      } else if (category === "brackets") {
        const bracketSize = WALL_BRACKET_MAP[wBre];
        const displayBracket =
          parseFloat(
            dims.breadth === "custom" ? dims.customBreadth : dims.breadth,
          ) + 0.75;
        label = `${displayBracket}" Bracket`;
        price = MOCK_PRICING.wall.brackets[bracketSize] || 0;
      } else if (category === "stoppers") {
        const stopperSize = WALL_STOPPER_MAP[wLen];
        label =
          dims.length === "custom"
            ? `${dims.customLength}" Stopper`
            : `${stopperSize}ft Stopper`;
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

  const handleCartQtyChange = (id, value) => {
    if (value === "") {
      setCart((prev) =>
        prev.map((item) => (item.id === id ? { ...item, qty: "" } : item)),
      );
      return;
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return;

    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, qty: Math.max(0, parsed) } : item,
        )
        .filter((item) => item.qty === "" || item.qty > 0),
    );
    setOverrides({});
  };

  const handleCartQtyBlur = (id, qty) => {
    if (qty === "" || qty === 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleOverrideChange = (itemKey, value) => {
    const val = value === "" ? "" : parseInt(value);
    setOverrides((prev) => ({ ...prev, [itemKey]: val }));
  };

  // ── Helper: capture the dark snapshot canvas at high DPI ──────────────────
  const captureSnapshotCanvas = async (scale = 4) => {
    if (!quoteRef.current) throw new Error("Snapshot element not found");
    await new Promise((res) => setTimeout(res, 200));
    const canvas = await html2canvas(quoteRef.current, {
      backgroundColor: "#111827",
      scale,
      useCORS: true,
      imageTimeout: 0,
      logging: false,
    });
    // Disable smoothing so text stays crisp when downscaled
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.imageSmoothingEnabled = false;
    return canvas;
  };

  // ── Share Snapshot (image) ─────────────────────────────────────────────────
  const handleShareSnapshot = async () => {
    if (!quoteRef.current) return;
    setIsCapturing(true);
    try {
      const canvas = await captureSnapshotCanvas(4);

      const imageBlob = await new Promise(
        (resolve) => canvas.toBlob(resolve, "image/png", 1.0),
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


  // ── WhatsApp/PDF Share: Send snapshot PDF or download it ─────────────────────
  const handleWhatsAppPDF = async () => {
    let formattedNumber = "";
    if (customerPhone) {
      formattedNumber = customerPhone.replace(/\D/g, "");
      if (formattedNumber.length === 10) {
        formattedNumber = "91" + formattedNumber;
      } else if (formattedNumber.length < 10) {
        alert("Please enter a valid 10-digit mobile number.");
        return;
      }
    }

    setIsWhatsappPDF(true);
    try {
      const canvas = await captureSnapshotCanvas(3);

      const pxToMm = 25.4 / 96;
      const pageW = canvas.width * pxToMm;
      const pageH = canvas.height * pxToMm;

      const pdf = new jsPDF({
        orientation: pageW > pageH ? "landscape" : "portrait",
        unit: "mm",
        format: [pageW, pageH],
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.90);
      pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH);

      const fileName = `VARUN_Quote_${customerName ? customerName.replace(/\s+/g, "_") : "Snapshot"}.pdf`;
      const pdfBlob = pdf.output("blob");
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      // ── Mobile path: native share sheet lets user pick WhatsApp/email/etc. & PDF is attached directly ──
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "VARUN Quotation",
          text: `Quotation from VARUN Enterprise — Total: ₹${quote?.grandTotal?.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
          files: [file],
        });
      } else {
        // ── Desktop path: download PDF ──
        const blobUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);

        if (formattedNumber) {
          // Open WhatsApp Web directly in the target chat
          setTimeout(() => {
            window.open(`https://web.whatsapp.com/send?phone=${formattedNumber}`, "_blank");
            setTimeout(() => {
              alert(
                `✅ PDF "${fileName}" has been downloaded to your Downloads folder.\n\n` +
                `WhatsApp Web has opened with the contact (+${formattedNumber}).\n\n` +
                `📎 Click the attachment (paperclip) icon in the chat and select the downloaded PDF to send it.`
              );
            }, 800);
          }, 600);
        } else {
          setTimeout(() => {
            alert(`✅ PDF "${fileName}" has been successfully generated and downloaded.`);
          }, 600);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong while generating the PDF.");
    } finally {
      setIsWhatsappPDF(false);
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

  const handleFetchGst = async () => {
    setGstError("");

    // 1. Validate GST format (Permissive: 15 alphanumeric characters)
    const gstRegex = /^[A-Z0-9]{15}$/;
    if (!gstRegex.test(customerGst)) {
      setGstError("Invalid GST format");
      return;
    }

    setIsFetchingGst(true);

    try {
      // RapidAPI Request
      const response = await fetch(
        `https://gst-insights-api.p.rapidapi.com/getGSTDetailsUsingGST/${customerGst}`,
        {
          method: "GET",
          headers: {
            "x-rapidapi-key":
              "7a127dbc7dmsh1874e61a24751c1p106ccajsn15976fa7fe70", // <-- PASTE YOUR KEY HERE
            "x-rapidapi-host": "gst-insights-api.p.rapidapi.com", // <-- VERIFY HOST NAME FROM RAPIDAPI
          },
        },
      );

      const apiResponse = await response.json();

      if (
        apiResponse &&
        apiResponse.success &&
        apiResponse.data &&
        apiResponse.data.length > 0
      ) {
        const gstData = apiResponse.data[0];

        // 1. Get Company Name
        const companyName = gstData.tradeName || gstData.legalName;

        // 2. Build Address String gracefully
        const addrObj = gstData.principalAddress?.address || {};
        const addressParts = [
          addrObj.floorNumber,
          addrObj.buildingNumber,
          addrObj.buildingName,
          addrObj.street,
          addrObj.location,
          addrObj.district,
          addrObj.stateCode,
          addrObj.pincode,
        ].filter((part) => part && part.trim() !== "NA" && part.trim() !== "");

        const fullAddress = addressParts.join(", ");

        setCustomerName(companyName || "");
        setCustomerAddress(fullAddress || "");
      } else {
        throw new Error("GST Details not found");
      }
    } catch (err) {
      setGstError("Could not fetch details. Please enter manually.");
    } finally {
      setIsFetchingGst(false);
    }
  };

  const handleSharePDF = async () => {
    if (!quote || quote.enrichedCart.length === 0) {
      alert("Please add items to the quote first.");
      return;
    }

    setIsGeneratingPDF(true);

    try {
      await new Promise((res) => setTimeout(res, 300));

      const element = letterheadRef.current;
      if (!element) throw new Error("Letterhead element not found");

      // 1. Capture the full letterhead
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        imageTimeout: 0,
        logging: false,
      });

      // 2. Set up PDF dimensions
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const HEADER_H = 14;
      const FOOTER_H = 10;

      // Page 1 has no top header (it's in the canvas), so it uses more canvas
      const page1ContentH = pageH - FOOTER_H;
      // Pages 2+ have a header and footer
      const pageNContentH = pageH - HEADER_H - FOOTER_H;

      const pxPerMm = canvas.width / pageW;
      const page1PxH = page1ContentH * pxPerMm;
      const pageNPxH = pageNContentH * pxPerMm;

      const remainingAfterP1 = Math.max(0, canvas.height - page1PxH);
      const totalPages = 1 + (remainingAfterP1 > 0 ? Math.ceil(remainingAfterP1 / pageNPxH) : 0);

      const today = new Date().toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      });

      let srcY = 0;

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        if (pageIdx > 0) pdf.addPage();

        const isFirstPage = pageIdx === 0;
        const contentPxH = isFirstPage ? page1PxH : pageNPxH;
        const imageY_mm = isFirstPage ? 0 : HEADER_H;
        const srcH = Math.min(contentPxH, canvas.height - srcY);

        // 3. Slice this page portion
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = srcH;
        sliceCanvas.getContext("2d").drawImage(canvas, 0, -srcY);

        const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
        const sliceH_mm = srcH / pxPerMm;
        pdf.addImage(sliceData, "JPEG", 0, imageY_mm, pageW, sliceH_mm);

        // Continuation header (pages 2+)
        if (!isFirstPage) {
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, pageW, HEADER_H, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.setTextColor(20, 20, 20);
          pdf.text("VARUN ENTERPRISE", pageW / 2, 6, { align: "center" });
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.setTextColor(80, 80, 80);
          pdf.text(
            "M: 9724703241 | 9824101301  |  Quotation (Contd.)",
            pageW / 2, 10.5, { align: "center" }
          );
          pdf.setDrawColor(60, 60, 60);
          pdf.setLineWidth(0.4);
          pdf.line(8, HEADER_H - 0.5, pageW - 8, HEADER_H - 0.5);
        }

        // Footer on all pages
        const footerTopY = pageH - FOOTER_H;
        pdf.setFillColor(248, 249, 250);
        pdf.rect(0, footerTopY, pageW, FOOTER_H, "F");
        pdf.setDrawColor(160, 160, 160);
        pdf.setLineWidth(0.3);
        pdf.line(8, footerTopY + 1.5, pageW - 8, footerTopY + 1.5);
        const textY = footerTopY + 7;
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text("VARUN Enterprise", 8, textY);
        pdf.setFont("helvetica", "normal");
        pdf.text("Page " + (pageIdx + 1) + " of " + totalPages, pageW / 2, textY, { align: "center" });
        pdf.text(today, pageW - 8, textY, { align: "right" });

        srcY += contentPxH;
      }

      // 4. Share or download
      const fileName = `VARUN_Quotation_${customerName ? customerName.replace(/\s+/g, "_") : "Estimate"}.pdf`;
      const pdfBlob = pdf.output("blob");
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "VARUN Enterprise Quotation",
          text: "Please find the attached quotation.",
          files: [file],
        });
      } else {
        pdf.save(fileName);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong while generating the PDF.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // --- CORE ENGINE ---
  const quote = useMemo(() => {
    return calculateQuote({
      cart,
      overrides,
      slottedFittingRate,
      wallFittingRate,
      pigeonFittingCharge,
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
    pigeonFittingCharge,
    gondolaFittingCharge,
    rickshawRent,
    isFittingOpted,
    applyMarkup,
  ]);

  // UI Helpers
  const isSlotted = activeTab === "slotted";
  const isWall = activeTab === "wall";
  const isPigeon = activeTab === "pigeon";
  const currentWallShelves =
    buildMode === "standard" ? selectedCell.y || 5 : mixedShelves || 5;
  const currLength = isSlotted
    ? slottedDims.length
    : isWall
      ? wallDims.length
      : pigeonDims.length;

  return (
    <>
      <div
        className={`${isGeneratingPDF ? "hidden" : "block"} print:hidden max-w-7xl mx-auto p-4 md:p-6 bg-gray-50 min-h-screen`}
      >
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
              Slotted
            </button>
            <button
              onClick={() => setActiveTab("wall")}
              className={`flex-shrink-0 px-5 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === "wall" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Wall
            </button>
            <button
              onClick={() => setActiveTab("pigeon")}
              className={`flex-shrink-0 px-5 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === "pigeon" ? "bg-white text-orange-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Pigeon Hole
            </button>
            <button
              onClick={() => setActiveTab("gondola")}
              className={`flex-shrink-0 px-5 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeTab === "gondola" ? "bg-white text-teal-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Gondola
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
                      Customize dimensions, structure, and options.
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
                              <option value="custom">Custom (Inches)</option>
                            </select>
                            {slottedDims.breadth === "custom" && (
                              <div className="mt-2 animate-in slide-in-from-top-1">
                                <input
                                  type="number"
                                  name="customBreadth"
                                  value={slottedDims.customBreadth}
                                  onChange={(e) =>
                                    handleDimChange(e, "slotted")
                                  }
                                  placeholder="Enter in inches"
                                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                                />
                                {slottedDims.customBreadth > 24 && (
                                  <p className="text-red-500 text-xs mt-1 font-semibold">
                                    Maximum size is 24"
                                  </p>
                                )}
                              </div>
                            )}
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
                              <option value="custom">Custom (Inches)</option>
                            </select>
                            {slottedDims.height === "custom" && (
                              <div className="mt-2 animate-in slide-in-from-top-1">
                                <input
                                  type="number"
                                  name="customHeight"
                                  value={slottedDims.customHeight}
                                  onChange={(e) =>
                                    handleDimChange(e, "slotted")
                                  }
                                  placeholder="Enter in inches"
                                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                                />
                                {slottedDims.customHeight > 120 && (
                                  <p className="text-red-500 text-xs mt-1 font-semibold">
                                    Maximum size is 120" (10 ft)
                                  </p>
                                )}
                              </div>
                            )}
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
                          <h3 className="font-semibold text-gray-800">
                            Colors
                          </h3>
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
                            ["custom", "Custom (Inches)"],
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
                            ["custom", "Custom (Inches)"],
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
                              ) && (
                                <option value="22D">22G (Double Part)</option>
                              )}
                          </select>

                          {field.name === "breadth" &&
                            wallDims.breadth === "custom" && (
                              <div className="mt-2 animate-in slide-in-from-top-1">
                                <input
                                  type="number"
                                  name="customBreadth"
                                  value={wallDims.customBreadth}
                                  onChange={(e) => handleDimChange(e, "wall")}
                                  placeholder="Enter in inches"
                                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                                />
                                {wallDims.customBreadth > 16.25 && (
                                  <p className="text-red-500 text-xs mt-1 font-semibold">
                                    Maximum size is 16.25"
                                  </p>
                                )}
                              </div>
                            )}

                          {field.name === "height" &&
                            wallDims.height === "custom" && (
                              <div className="mt-2 animate-in slide-in-from-top-1">
                                <input
                                  type="number"
                                  name="customHeight"
                                  value={wallDims.customHeight}
                                  onChange={(e) => handleDimChange(e, "wall")}
                                  placeholder="Enter in inches"
                                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                                />
                                {wallDims.customHeight > 72 && (
                                  <p className="text-red-500 text-xs mt-1 font-semibold">
                                    Maximum size is 72" (6 ft)
                                  </p>
                                )}
                              </div>
                            )}
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

                    {/* CUSTOM BREADTH PER LAYER */}
                    <div className="mt-6 rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-6 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-800 text-base">
                            Mixed Shelf Depths
                          </h4>
                          <p className="text-sm text-gray-500">
                            Set custom depths per shelf level
                          </p>
                        </div>
                        {/* TOGGLE */}
                        <button
                          type="button"
                          onClick={() =>
                            setWallDims((prev) => ({
                              ...prev,
                              useCustomBreadths: !prev.useCustomBreadths,
                              customBreadths:
                                prev.customBreadths &&
                                  prev.customBreadths.length ===
                                  (currentWallShelves || 5)
                                  ? prev.customBreadths
                                  : Array(currentWallShelves || 5).fill(
                                    prev.breadth || "9.25",
                                  ),
                            }))
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${wallDims.useCustomBreadths ? "bg-indigo-600" : "bg-gray-300"}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${wallDims.useCustomBreadths ? "translate-x-6" : "translate-x-1"}`}
                          />
                        </button>
                      </div>

                      {wallDims.useCustomBreadths && (
                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 bg-indigo-50/20 p-4 rounded-xl border border-indigo-100 animate-in slide-in-from-top-2 duration-200">
                          {Array.from({ length: currentWallShelves || 5 })
                            .map((_, idx) => {
                              const layerBreadth =
                                wallDims.customBreadths?.[idx] ||
                                wallDims.breadth ||
                                "9.25";
                              return (
                                <div
                                  key={`wall-layer-${idx}`}
                                  className="flex flex-col gap-1"
                                >
                                  <span className="text-xs text-gray-600 font-semibold uppercase tracking-wider">
                                    Shelf Layer {idx + 1}{" "}
                                    {idx === 0
                                      ? "(Bottom)"
                                      : idx === (currentWallShelves || 5) - 1
                                        ? "(Top)"
                                        : ""}
                                  </span>
                                  <select
                                    value={layerBreadth}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setWallDims((prev) => {
                                        const newArr = [
                                          ...(prev.customBreadths ||
                                            Array(currentWallShelves || 5).fill(
                                              prev.breadth || "9.25",
                                            )),
                                        ];
                                        newArr[idx] = val;
                                        return {
                                          ...prev,
                                          customBreadths: newArr,
                                        };
                                      });
                                    }}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 transition"
                                  >
                                    <option value="6.25">6.25"</option>
                                    <option value="9.25">9.25"</option>
                                    <option value="12.25">12.25"</option>
                                    <option value="14.25">14.25"</option>
                                    <option value="16.25">16.25"</option>
                                    <option value="custom">Custom</option>
                                  </select>
                                  {layerBreadth === "custom" && (
                                    <input
                                      type="number"
                                      value={
                                        wallDims.customBreadthsVals?.[idx] ||
                                        "10"
                                      }
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setWallDims((prev) => {
                                          const newArr = [
                                            ...(prev.customBreadthsVals ||
                                              Array(
                                                currentWallShelves || 5,
                                              ).fill("10")),
                                          ];
                                          newArr[idx] = val;
                                          return {
                                            ...prev,
                                            customBreadthsVals: newArr,
                                          };
                                        });
                                      }}
                                      placeholder="inches"
                                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm outline-none focus:border-indigo-500 transition mt-1"
                                    />
                                  )}
                                </div>
                              );
                            })
                            .reverse()}
                        </div>
                      )}
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
                              Width
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
                              <option value="custom">Custom (Inches)</option>
                            </select>
                            {pigeonDims.length === "custom" && (
                              <div className="mt-2 animate-in slide-in-from-top-1">
                                <input
                                  type="number"
                                  value={pigeonDims.customLength}
                                  onChange={(e) =>
                                    setPigeonDims({
                                      ...pigeonDims,
                                      customLength: e.target.value,
                                    })
                                  }
                                  placeholder="Enter in inches"
                                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                                />
                                {pigeonDims.customLength > 48 && (
                                  <p className="text-red-500 text-xs mt-1 font-semibold">
                                    Maximum size is 48" (4 ft)
                                  </p>
                                )}
                              </div>
                            )}
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
                              <option value="custom">Custom (Inches)</option>
                            </select>
                            {pigeonDims.breadth === "custom" && (
                              <div className="mt-2 animate-in slide-in-from-top-1">
                                <input
                                  type="number"
                                  value={pigeonDims.customBreadth}
                                  onChange={(e) =>
                                    setPigeonDims({
                                      ...pigeonDims,
                                      customBreadth: e.target.value,
                                    })
                                  }
                                  placeholder="Enter in inches"
                                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                                />
                                {pigeonDims.customBreadth > 24 && (
                                  <p className="text-red-500 text-xs mt-1 font-semibold">
                                    Maximum size is 24"
                                  </p>
                                )}
                              </div>
                            )}
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
                              <option value="custom">Custom (Inches)</option>
                            </select>
                            {pigeonDims.height === "custom" && (
                              <div className="mt-2 animate-in slide-in-from-top-1">
                                <input
                                  type="number"
                                  value={pigeonDims.customHeight}
                                  onChange={(e) =>
                                    setPigeonDims({
                                      ...pigeonDims,
                                      customHeight: e.target.value,
                                    })
                                  }
                                  placeholder="Enter in inches"
                                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                                />
                                {pigeonDims.customHeight > 120 && (
                                  <p className="text-red-500 text-xs mt-1 font-semibold">
                                    Maximum size is 120" (10 ft)
                                  </p>
                                )}
                              </div>
                            )}
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
                                Add Front 3" Stoppers
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* LAYOUT */}
                      <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-orange-50/30 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="font-semibold text-gray-800">
                            Layout
                          </h3>
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
                                handlePigeonRowsChange(e.target.value)
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
                                handlePigeonColumnsChange(e.target.value)
                              }
                              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                            />
                          </div>

                          <label className="flex items-center justify-between p-3 bg-orange-50/50 border border-orange-100 rounded-xl cursor-pointer hover:bg-orange-100/50 transition">
                            <div>
                              <p className="font-semibold text-xs text-orange-950 uppercase tracking-wide">
                                Custom Columns
                              </p>
                              <p className="text-[10px] text-orange-700">
                                Set columns per level.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setPigeonDims((prev) => {
                                  const needed = Math.max(1, prev.rows - 1);
                                  let customColumns = [
                                    ...(prev.customColumns || []),
                                  ];
                                  if (customColumns.length < needed) {
                                    const diff = needed - customColumns.length;
                                    for (let i = 0; i < diff; i++) {
                                      customColumns.push(prev.columns);
                                    }
                                  } else {
                                    customColumns = customColumns.slice(
                                      0,
                                      needed,
                                    );
                                  }
                                  return {
                                    ...prev,
                                    useCustomColumns: !prev.useCustomColumns,
                                    customColumns,
                                  };
                                });
                              }}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${pigeonDims.useCustomColumns ? "bg-orange-600" : "bg-gray-300"}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${pigeonDims.useCustomColumns ? "translate-x-6" : "translate-x-1"}`}
                              />
                            </button>
                          </label>

                          {pigeonDims.useCustomColumns && (
                            <div className="space-y-3 bg-orange-50/20 p-4 rounded-xl border border-orange-100 animate-in slide-in-from-top-2 duration-200">
                              <p className="text-[10px] font-bold text-orange-800 uppercase tracking-wider mb-1">
                                Columns (Top to Bottom)
                              </p>
                              {(pigeonDims.customColumns || []).map(
                                (colVal, idx) => (
                                  <div
                                    key={`custom-col-${idx}`}
                                    className="flex justify-between items-center gap-3"
                                  >
                                    <span className="text-xs text-gray-600 font-medium">
                                      Shelf {idx + 1}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={colVal}
                                        onChange={(e) => {
                                          const newColVal =
                                            e.target.value === ""
                                              ? ""
                                              : parseInt(e.target.value) || 0;
                                          setPigeonDims((prev) => {
                                            const newArr = [
                                              ...(prev.customColumns || []),
                                            ];
                                            newArr[idx] = newColVal;
                                            return {
                                              ...prev,
                                              customColumns: newArr,
                                            };
                                          });
                                        }}
                                        className="w-16 bg-white border border-gray-300 rounded p-1 text-center font-bold text-sm focus:ring-1 focus:ring-orange-500 outline-none"
                                      />
                                      <span className="text-xs text-gray-500">
                                        Cols
                                      </span>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
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
                              {(() => {
                                const totalLenIn =
                                  pigeonDims.length === "custom"
                                    ? parseFloat(pigeonDims.customLength) || 0
                                    : parseFloat(pigeonDims.length) * 12;
                                if (
                                  pigeonDims.useCustomColumns &&
                                  Array.isArray(pigeonDims.customColumns)
                                ) {
                                  const uniqueCols = Array.from(
                                    new Set(
                                      pigeonDims.customColumns.map((c) =>
                                        c === ""
                                          ? 3
                                          : Math.max(1, parseInt(c) || 3),
                                      ),
                                    ),
                                  );
                                  const calcRows =
                                    pigeonDims.rows === ""
                                      ? 4
                                      : Math.max(
                                        2,
                                        parseInt(pigeonDims.rows) || 4,
                                      );
                                  const heightPart = (
                                    ((pigeonDims.height === "custom"
                                      ? parseFloat(pigeonDims.customHeight) || 0
                                      : parseFloat(pigeonDims.height) * 12) -
                                      3) /
                                    Math.max(1, calcRows - 1)
                                  ).toFixed(1);
                                  const breadthPart =
                                    pigeonDims.breadth === "custom"
                                      ? pigeonDims.customBreadth || 0
                                      : pigeonDims.breadth;
                                  if (uniqueCols.length === 1) {
                                    return `${(totalLenIn / uniqueCols[0]).toFixed(1)}" × ${breadthPart}" × ${heightPart}"`;
                                  }
                                  const sortedWidths = uniqueCols
                                    .map((c) => totalLenIn / Math.max(1, c))
                                    .sort((a, b) => a - b);
                                  return `${sortedWidths[0].toFixed(1)}"-${sortedWidths[sortedWidths.length - 1].toFixed(1)}" W × ${breadthPart}" D × ${heightPart}" H`;
                                }
                                const calcCols =
                                  pigeonDims.columns === ""
                                    ? 3
                                    : Math.max(
                                      1,
                                      parseInt(pigeonDims.columns) || 3,
                                    );
                                const calcRows =
                                  pigeonDims.rows === ""
                                    ? 4
                                    : Math.max(
                                      2,
                                      parseInt(pigeonDims.rows) || 4,
                                    );
                                return `${((pigeonDims.length === "custom" ? parseFloat(pigeonDims.customLength) || 0 : parseFloat(pigeonDims.length) * 12) / Math.max(1, calcCols)).toFixed(1)}" × ${pigeonDims.breadth === "custom" ? pigeonDims.customBreadth || 0 : pigeonDims.breadth}" × ${(((pigeonDims.height === "custom" ? parseFloat(pigeonDims.customHeight) || 0 : parseFloat(pigeonDims.height) * 12) - 3) / Math.max(1, calcRows - 1)).toFixed(1)}"`;
                              })()}
                            </p>
                          </div>

                          <div className="bg-orange-100 text-orange-700 text-sm font-medium px-3 py-2 rounded-lg">
                            {pigeonDims.useCustomColumns &&
                              Array.isArray(pigeonDims.customColumns)
                              ? pigeonDims.customColumns.reduce(
                                (sum, val) =>
                                  sum +
                                  (val === ""
                                    ? 3
                                    : Math.max(1, parseInt(val) || 3)),
                                0,
                              )
                              : ((pigeonDims.rows === ""
                                ? 4
                                : Math.max(
                                  2,
                                  parseInt(pigeonDims.rows) || 4,
                                )) -
                                1) *
                              (pigeonDims.columns === ""
                                ? 3
                                : Math.max(
                                  1,
                                  parseInt(pigeonDims.columns) || 3,
                                ))}{" "}
                            Total Compartments
                          </div>
                        </div>
                      </div>

                      {/* CTA */}
                      <button
                        onClick={() => {
                          const bayVal =
                            pigeonDims.length === "custom"
                              ? { isCustom: true, val: pigeonDims.customLength }
                              : parseInt(pigeonDims.length);
                          const finalRows =
                            pigeonDims.rows === ""
                              ? 4
                              : Math.max(2, parseInt(pigeonDims.rows) || 4);
                          const finalCols =
                            pigeonDims.columns === ""
                              ? 3
                              : Math.max(1, parseInt(pigeonDims.columns) || 3);
                          const finalCustom = (
                            pigeonDims.customColumns || []
                          ).map((c) =>
                            c === "" ? 3 : Math.max(1, parseInt(c) || 3),
                          );
                          setCart((prev) => [
                            ...prev,
                            {
                              id: Date.now(),
                              type: "pigeon",
                              dimensions: {
                                ...pigeonDims,
                                rows: finalRows,
                                columns: finalCols,
                                customColumns: finalCustom,
                              },
                              bays: [bayVal],
                              shelvesPerRack: finalRows,
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
                            <option value="custom">Custom (Inches)</option>
                          </select>
                          {gondolaDims.height === "custom" && (
                            <div className="mt-2 animate-in slide-in-from-top-1">
                              <input
                                type="number"
                                value={gondolaDims.customHeight}
                                onChange={(e) =>
                                  setGondolaDims({
                                    ...gondolaDims,
                                    customHeight: e.target.value,
                                  })
                                }
                                placeholder="Enter in inches"
                                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition"
                              />
                              {gondolaDims.customHeight > 84 && (
                                <p className="text-red-500 text-xs mt-1 font-semibold">
                                  Maximum size is 84" (7 ft)
                                </p>
                              )}
                            </div>
                          )}
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
                            <option value="custom">Custom (Inches)</option>
                          </select>
                          {gondolaDims.breadth === "custom" && (
                            <div className="mt-2 animate-in slide-in-from-top-1">
                              <input
                                type="number"
                                value={gondolaDims.customBreadth}
                                onChange={(e) =>
                                  setGondolaDims({
                                    ...gondolaDims,
                                    customBreadth: e.target.value,
                                  })
                                }
                                placeholder="Enter in inches"
                                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition"
                              />
                              {gondolaDims.customBreadth > 16.25 && (
                                <p className="text-red-500 text-xs mt-1 font-semibold">
                                  Maximum size is 16.25"
                                </p>
                              )}
                            </div>
                          )}
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
                              handleGondolaShelvesChange(e.target.value)
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* CUSTOM BREADTH PER LAYER */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-800 text-base">
                            Mixed Shelf Depths
                          </h4>
                          <p className="text-sm text-gray-500">
                            Set custom depths per shelf level
                          </p>
                        </div>
                        {/* TOGGLE */}
                        <button
                          type="button"
                          onClick={() =>
                            setGondolaDims((prev) => ({
                              ...prev,
                              useCustomBreadths: !prev.useCustomBreadths,
                              customBreadths:
                                prev.customBreadths &&
                                  prev.customBreadths.length ===
                                  (prev.shelves || 4)
                                  ? prev.customBreadths
                                  : Array(prev.shelves || 4).fill(
                                    prev.breadth || "12.25",
                                  ),
                            }))
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${gondolaDims.useCustomBreadths ? "bg-teal-600" : "bg-gray-300"}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gondolaDims.useCustomBreadths ? "translate-x-6" : "translate-x-1"}`}
                          />
                        </button>
                      </div>

                      {gondolaDims.useCustomBreadths && (
                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 bg-teal-50/20 p-4 rounded-xl border border-teal-100 animate-in slide-in-from-top-2 duration-200">
                          {Array.from({ length: gondolaDims.shelves || 4 })
                            .map((_, idx) => {
                              const layerBreadth =
                                gondolaDims.customBreadths?.[idx] ||
                                gondolaDims.breadth ||
                                "12.25";
                              return (
                                <div
                                  key={`gondola-layer-${idx}`}
                                  className="flex flex-col gap-1"
                                >
                                  <span className="text-xs text-gray-600 font-semibold uppercase tracking-wider">
                                    Shelf Layer {idx + 1}{" "}
                                    {idx === 0
                                      ? "(Bottom)"
                                      : idx === (gondolaDims.shelves || 4) - 1
                                        ? "(Top)"
                                        : ""}
                                  </span>
                                  <select
                                    value={layerBreadth}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setGondolaDims((prev) => {
                                        const newArr = [
                                          ...(prev.customBreadths ||
                                            Array(prev.shelves || 4).fill(
                                              prev.breadth || "12.25",
                                            )),
                                        ];
                                        newArr[idx] = val;
                                        return {
                                          ...prev,
                                          customBreadths: newArr,
                                        };
                                      });
                                    }}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-500 transition"
                                  >
                                    <option value="6.25">6.25"</option>
                                    <option value="9.25">9.25"</option>
                                    <option value="12.25">12.25"</option>
                                    <option value="14.25">14.25"</option>
                                    <option value="16.25">16.25"</option>
                                    <option value="custom">Custom</option>
                                  </select>
                                  {layerBreadth === "custom" && (
                                    <input
                                      type="number"
                                      value={
                                        gondolaDims.customBreadthsVals?.[idx] ||
                                        "10"
                                      }
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setGondolaDims((prev) => {
                                          const newArr = [
                                            ...(prev.customBreadthsVals ||
                                              Array(prev.shelves || 4).fill(
                                                "10",
                                              )),
                                          ];
                                          newArr[idx] = val;
                                          return {
                                            ...prev,
                                            customBreadthsVals: newArr,
                                          };
                                        });
                                      }}
                                      placeholder="inches"
                                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm outline-none focus:border-teal-500 transition mt-1"
                                    />
                                  )}
                                </div>
                              );
                            })
                            .reverse()}
                        </div>
                      )}
                    </div>

                    {/* OPTIONS + ROW BUILDER */}
                    <div className="bg-gradient-to-r from-teal-50 to-white border border-teal-200 rounded-2xl shadow-sm p-6 flex flex-col gap-6">
                      {/* CHECKBOXES */}
                      <div className="flex flex-wrap gap-6">
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

                      {/* MULTI-BAY ROW BUILDER */}
                      <div className="flex flex-col gap-5 flex-1 w-full">
                        {/* Append controls */}
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                            Append Racks to Row:
                          </span>
                          <button
                            onClick={() =>
                              setGondolaMixedBays((prev) =>
                                prev.length > 0 ? prev.slice(0, -1) : prev,
                              )
                            }
                            disabled={gondolaMixedBays.length === 0}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-gray-200 bg-white hover:border-red-300 hover:bg-red-50 text-gray-600 hover:text-red-600 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <path d="M9 14l-4-4 4-4" />
                              <path d="M5 10h11a4 4 0 0 1 0 8h-1" />
                            </svg>
                            Undo Last
                          </button>
                          <button
                            onClick={() =>
                              setGondolaMixedBays((prev) => [...prev, 3])
                            }
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-teal-200 bg-white hover:border-teal-500 hover:bg-teal-50 text-teal-700 font-bold text-sm transition-all shadow-sm"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                            3 ft Rack
                          </button>
                          <button
                            onClick={() =>
                              setGondolaMixedBays((prev) => [...prev, 4])
                            }
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-teal-200 bg-white hover:border-teal-500 hover:bg-teal-50 text-teal-700 font-bold text-sm transition-all shadow-sm"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-4 h-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                            4 ft Rack
                          </button>
                          <div className="flex items-center gap-1 border-2 border-teal-200 rounded-lg p-1 bg-white shadow-sm">
                            <input
                              type="number"
                              placeholder='Size (")'
                              className="w-20 px-2 py-1 outline-none text-teal-700 font-bold text-sm"
                              value={gondolaDims.customLength}
                              onChange={(e) =>
                                setGondolaDims({
                                  ...gondolaDims,
                                  customLength: e.target.value,
                                })
                              }
                            />
                            <button
                              onClick={() => {
                                if (gondolaDims.customLength)
                                  setGondolaMixedBays((prev) => [
                                    ...prev,
                                    {
                                      isCustom: true,
                                      val: parseFloat(gondolaDims.customLength),
                                    },
                                  ]);
                              }}
                              disabled={!gondolaDims.customLength}
                              className="bg-teal-100 hover:bg-teal-200 disabled:opacity-50 text-teal-700 font-bold py-1.5 px-3 rounded-md transition-colors flex items-center gap-1 text-sm"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <path d="M12 5v14M5 12h14" />
                              </svg>
                              Add
                            </button>
                          </div>
                        </div>

                        {/* Row visualizer */}
                        <div className="bg-slate-900 rounded-xl p-5 shadow-inner text-white overflow-x-auto min-h-[110px] flex flex-col justify-center">
                          {gondolaMixedBays.length === 0 ? (
                            <p className="text-slate-500 text-center italic text-sm">
                              Add racks above to start building.
                            </p>
                          ) : (
                            <div>
                              <div className="flex items-stretch min-w-max">
                                <div
                                  className="w-2 bg-slate-400 rounded-full flex-shrink-0"
                                  title="Stand"
                                />
                                {gondolaMixedBays.map((bay, idx) => (
                                  <React.Fragment key={idx}>
                                    <div className="flex flex-col items-center justify-center px-4 md:px-8 border-y-2 border-slate-700 flex-grow text-slate-300 font-mono font-bold">
                                      {bay?.isCustom
                                        ? `${bay.val}"`
                                        : `${bay} ft`}
                                    </div>
                                    <div
                                      className="w-2 bg-slate-400 rounded-full flex-shrink-0"
                                      title="Shared Stand"
                                    />
                                  </React.Fragment>
                                ))}
                              </div>
                              <p className="text-center mt-3 font-bold tracking-widest text-teal-400 text-sm">
                                TOTAL SPAN:{" "}
                                {`${gondolaMixedBays.reduce((a, b) => a + (b?.isCustom ? b.val / 12 : b), 0).toFixed(1)} ft`}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Add to Quote button */}
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              if (gondolaMixedBays.length === 0) return;
                              const finalShelves =
                                gondolaDims.shelves === ""
                                  ? 4
                                  : Math.max(
                                    1,
                                    parseInt(gondolaDims.shelves) || 4,
                                  );
                              setCart((prev) => [
                                ...prev,
                                {
                                  id: Date.now(),
                                  type: "gondola",
                                  dimensions: {
                                    ...gondolaDims,
                                    shelves: finalShelves,
                                  },
                                  bays: [...gondolaMixedBays],
                                  shelvesPerRack: finalShelves,
                                  qty: 1,
                                },
                              ]);
                              setGondolaMixedBays([]);
                            }}
                            disabled={gondolaMixedBays.length === 0}
                            className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 active:scale-[0.98] transition-all text-white font-semibold px-7 py-3 rounded-xl shadow-md hover:shadow-lg"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-5 h-5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                            </svg>
                            Add Rack Row to Quote
                          </button>
                        </div>
                      </div>
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
                    Standard
                  </button>
                  <button
                    onClick={() => setBuildMode("mixed")}
                    className={`px-4 py-2 rounded-lg font-bold transition-colors ${buildMode === "mixed" ? (isSlotted ? "bg-blue-600 text-white" : "bg-indigo-600 text-white") : "text-gray-600 hover:bg-gray-200"}`}
                  >
                    Mixed
                  </button>
                  <button
                    onClick={() => setBuildMode("custom")}
                    className={`px-4 py-2 rounded-lg font-bold transition-colors ${buildMode === "custom" ? (isSlotted ? "bg-blue-600 text-white" : "bg-indigo-600 text-white") : "text-gray-600 hover:bg-gray-200"}`}
                  >
                    Parts
                  </button>
                </div>

                <div className="p-6">
                  {buildMode === "standard" ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex flex-col gap-4 mb-4">
                        <div className="flex items-center gap-4">
                          <label className="font-medium text-gray-700 text-sm whitespace-nowrap">
                            Plate Length:
                          </label>
                          <select
                            value={
                              isSlotted ? slottedDims.length : wallDims.length
                            }
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
                                <option value="custom">Custom (Inches)</option>
                              </>
                            ) : (
                              <>
                                <option value="35.5">35.5" (~3 ft)</option>
                                <option value="47.5">47.5" (~4 ft)</option>
                                <option value="custom">Custom (Inches)</option>
                              </>
                            )}
                          </select>
                        </div>
                        {((isSlotted && slottedDims.length === "custom") ||
                          (!isSlotted && wallDims.length === "custom")) && (
                            <div className="animate-in slide-in-from-top-1 w-full max-w-sm">
                              <input
                                type="number"
                                name="customLength"
                                value={
                                  isSlotted
                                    ? slottedDims.customLength
                                    : wallDims.customLength
                                }
                                onChange={(e) =>
                                  handleDimChange(
                                    e,
                                    isSlotted ? "slotted" : "wall",
                                  )
                                }
                                placeholder="Enter length in inches"
                                className={`w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:ring-2 outline-none transition ${isSlotted ? "focus:border-blue-500 focus:ring-blue-200" : "focus:border-indigo-500 focus:ring-indigo-200"}`}
                              />
                              {isSlotted && slottedDims.customLength > 48 && (
                                <p className="text-red-500 text-xs mt-1 font-semibold">
                                  Maximum size is 48" (4 ft)
                                </p>
                              )}
                              {!isSlotted && wallDims.customLength > 47.5 && (
                                <p className="text-red-500 text-xs mt-1 font-semibold">
                                  Maximum size is 47.5" (~4 ft)
                                </p>
                              )}
                            </div>
                          )}
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
                                      x <= selectedCell.x &&
                                      y <= selectedCell.y;
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
                          disabled={
                            selectedCell.x === 0 || selectedCell.y === 0
                          }
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
                            handleWallShelvesChange(e.target.value)
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
                              <div className="flex items-center gap-2 border-2 border-blue-200 rounded-lg p-1 bg-white">
                                <input
                                  type="number"
                                  placeholder='Size (")'
                                  className="w-20 px-2 py-1 outline-none text-blue-700 font-bold"
                                  value={slottedDims.customLength}
                                  onChange={(e) =>
                                    setSlottedDims({
                                      ...slottedDims,
                                      customLength: e.target.value,
                                    })
                                  }
                                />
                                <button
                                  onClick={() => {
                                    if (slottedDims.customLength)
                                      setMixedBays([
                                        ...mixedBays,
                                        {
                                          isCustom: true,
                                          val: parseFloat(
                                            slottedDims.customLength,
                                          ),
                                        },
                                      ]);
                                  }}
                                  disabled={
                                    !slottedDims.customLength ||
                                    slottedDims.customLength > 48
                                  }
                                  className="bg-blue-100 hover:bg-blue-200 disabled:opacity-50 text-blue-700 font-bold py-2 px-3 rounded-md transition-colors flex items-center justify-center"
                                >
                                  <Plus className="w-5 h-5" /> Add
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  setMixedBays([...mixedBays, 35.5])
                                }
                                className="bg-white border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50 text-indigo-700 font-bold py-3 px-6 rounded-lg transition-colors shadow-sm flex items-center gap-2 flex-1 sm:flex-none justify-center"
                              >
                                <Plus className="w-5 h-5" /> 3 ft Rack
                              </button>
                              <button
                                onClick={() =>
                                  setMixedBays([...mixedBays, 47.5])
                                }
                                className="bg-white border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50 text-indigo-700 font-bold py-3 px-6 rounded-lg transition-colors shadow-sm flex items-center gap-2 flex-1 sm:flex-none justify-center"
                              >
                                <Plus className="w-5 h-5" /> 4 ft Rack
                              </button>
                              <div className="flex items-center gap-2 border-2 border-indigo-200 rounded-lg p-1 bg-white">
                                <input
                                  type="number"
                                  placeholder='Size (")'
                                  className="w-20 px-2 py-1 outline-none text-indigo-700 font-bold"
                                  value={wallDims.customLength}
                                  onChange={(e) =>
                                    setWallDims({
                                      ...wallDims,
                                      customLength: e.target.value,
                                    })
                                  }
                                />
                                <button
                                  onClick={() => {
                                    if (wallDims.customLength)
                                      setMixedBays([
                                        ...mixedBays,
                                        {
                                          isCustom: true,
                                          val: parseFloat(
                                            wallDims.customLength,
                                          ),
                                        },
                                      ]);
                                  }}
                                  disabled={
                                    !wallDims.customLength ||
                                    wallDims.customLength > 47.5
                                  }
                                  className="bg-indigo-100 hover:bg-indigo-200 disabled:opacity-50 text-indigo-700 font-bold py-2 px-3 rounded-md transition-colors flex items-center justify-center"
                                >
                                  <Plus className="w-5 h-5" /> Add
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-900 rounded-xl p-6 shadow-inner text-white overflow-x-auto min-h-[140px] flex flex-col justify-center">
                        {mixedBays.length === 0 ? (
                          <p className="text-slate-500 text-center italic">
                            Add racks above to start building.
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
                                    {bay?.isCustom
                                      ? `${bay.val}"`
                                      : isSlotted
                                        ? `${bay} ft`
                                        : bay === 35.5
                                          ? "3 ft"
                                          : bay === 47.5
                                            ? "4 ft"
                                            : `${bay}"`}
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
                                ? `${mixedBays.reduce((a, b) => a + (b?.isCustom ? b.val / 12 : b), 0).toFixed(1)} ft`
                                : `${mixedBays.reduce((a, b) => a + (b?.isCustom ? b.val / 12 : b === 35.5 ? 3 : b === 47.5 ? 4 : b / 12), 0).toFixed(1)} ft`}
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
                                  handleDimChange(
                                    e,
                                    isSlotted ? "slotted" : "wall",
                                  )
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
                                  isSlotted
                                    ? slottedDims.breadth
                                    : wallDims.breadth
                                }
                                onChange={(e) =>
                                  handleDimChange(
                                    e,
                                    isSlotted ? "slotted" : "wall",
                                  )
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
                                  handleDimChange(
                                    e,
                                    isSlotted ? "slotted" : "wall",
                                  )
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
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.qty}
                                    onChange={(e) =>
                                      handleCartQtyChange(
                                        item.id,
                                        e.target.value,
                                      )
                                    }
                                    onBlur={() =>
                                      handleCartQtyBlur(item.id, item.qty)
                                    }
                                    className="w-12 bg-white border border-gray-300 rounded text-center font-bold text-sm focus:ring-1 focus:ring-blue-500 outline-none p-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
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

                      // --- Helpers ---
                      const isInchBased = item.type === "wall";
                      const getBayFt = (b) => {
                        if (typeof b === "object" && b.isCustom) {
                          // gondola custom is already in inches like wall custom
                          return isInchBased ? b.val / 12 : b.val / 12;
                        }
                        if (isInchBased) {
                          const val = parseFloat(b);
                          if (val === 35.5) return 3;
                          if (val === 47.5) return 4;
                          return val / 12;
                        }
                        // slotted and gondola are ft-based
                        return parseFloat(b);
                      };
                      const getBayLabel = (b) => {
                        if (typeof b === "object" && b.isCustom)
                          return `${b.val}"`;
                        if (isInchBased) {
                          const val = parseFloat(b);
                          if (val === 35.5) return `3 ft`;
                          if (val === 47.5) return `4 ft`;
                          return `${b}"`;
                        }
                        return `${b} ft`;
                      };
                      const getDimVal = (dimName) => {
                        let val = item.dimensions[dimName];
                        if (val === "custom") {
                          val =
                            item.dimensions[
                            `custom${dimName.charAt(0).toUpperCase() + dimName.slice(1)}`
                            ];
                        }
                        return parseFloat(val) || 0;
                      };
                      const getDimLabel = (dimName) => {
                        return item.dimensions[dimName] === "custom"
                          ? `${item.dimensions[`custom${dimName.charAt(0).toUpperCase() + dimName.slice(1)}`]}`
                          : item.dimensions[dimName];
                      };

                      // --- Text Formatting ---
                      const rackName = isSlotted
                        ? "Slotted Angle Rack"
                        : isPigeon
                          ? "Pigeon Hole Rack"
                          : isGondola
                            ? "Gondola Rack"
                            : "Wall Mounted Rack";

                      const totalSpanFt = item.bays.reduce(
                        (a, b) => a + getBayFt(b),
                        0,
                      );
                      const totalSpan = `${Number.isInteger(totalSpanFt) ? totalSpanFt : totalSpanFt.toFixed(1)} ft`;

                      const joinedLabel =
                        item.bays.length > 1
                          ? `${item.bays.length} Joined Racks`
                          : `1 Standalone Rack`;

                      const spanLabel = isGondola
                        ? `(${item.bays.map(getBayLabel).join(" + ")})`
                        : isPigeon
                          ? `(${getBayLabel(item.bays[0])})`
                          : isMixed
                            ? `Mixed Span (${item.bays.map(getBayLabel).join(" + ")})`
                            : `${joinedLabel} (${getBayLabel(item.bays[0])})`;

                      const isExpanded = expandedCartId === item.id;

                      // --- Material Calculations (for this specific row) ---
                      const totalAngles = (item.bays.length + 1) * item.qty * 2;
                      const platesPerBay = item.shelvesPerRack * item.qty;

                      const getPigeonDividersCount = () => {
                        const d = item.dimensions;
                        const spacesBetweenPlates = Math.max(
                          1,
                          item.shelvesPerRack - 1,
                        );
                        if (
                          d.useCustomColumns &&
                          Array.isArray(d.customColumns)
                        ) {
                          let sum = 0;
                          for (let i = 0; i < spacesBetweenPlates; i++) {
                            const cols =
                              d.customColumns[i] !== undefined
                                ? d.customColumns[i]
                                : d.columns;
                            sum += Math.max(0, cols - 1);
                          }
                          return sum * item.qty;
                        }
                        return (d.columns - 1) * spacesBetweenPlates * item.qty;
                      };

                      const getPigeonBoltsCount = () => {
                        const d = item.dimensions;
                        const spacesBetweenPlates = Math.max(
                          1,
                          item.shelvesPerRack - 1,
                        );

                        const spaceCols = [];
                        for (let s = 0; s < spacesBetweenPlates; s++) {
                          const cols =
                            d.useCustomColumns &&
                              Array.isArray(d.customColumns) &&
                              d.customColumns[s] !== undefined
                              ? d.customColumns[s]
                              : d.columns;
                          spaceCols.push(Math.max(1, cols));
                        }

                        let totalDividerBolts = 0;
                        for (let p = 0; p < item.shelvesPerRack; p++) {
                          const posBelow = new Set();
                          if (p > 0) {
                            const colsBelow = spaceCols[p - 1];
                            for (let i = 1; i < colsBelow; i++) {
                              posBelow.add((i / colsBelow).toFixed(6));
                            }
                          }

                          const posAbove = new Set();
                          if (p < spacesBetweenPlates) {
                            const colsAbove = spaceCols[p];
                            for (let i = 1; i < colsAbove; i++) {
                              posAbove.add((i / colsAbove).toFixed(6));
                            }
                          }

                          const union = new Set([...posBelow, ...posAbove]);
                          totalDividerBolts += union.size * 2;
                        }

                        const baseBolts =
                          totalAngles *
                          (item.shelvesPerRack >= 2
                            ? 2 * item.shelvesPerRack + 4
                            : 8) -
                          8 * item.qty;
                        const extraBolts = totalDividerBolts * item.qty;
                        return baseBolts + extraBolts;
                      };

                      // Group plates by size for this row
                      const uniqueBays = {};
                      item.bays.forEach((b) => {
                        const bKey =
                          typeof b === "object" && b.isCustom ? `${b.val}"` : b;
                        uniqueBays[bKey] =
                          (uniqueBays[bKey] || 0) + platesPerBay;
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
                                {getDimLabel("breadth")}" Depth •{" "}
                                {getDimLabel("height")}
                                {item.dimensions.height === "custom"
                                  ? '"'
                                  : "'"}{" "}
                                High • {item.shelvesPerRack} Shelves/Rack
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
                                <input
                                  type="number"
                                  min="0"
                                  value={item.qty}
                                  onChange={(e) =>
                                    handleCartQtyChange(item.id, e.target.value)
                                  }
                                  onBlur={() =>
                                    handleCartQtyBlur(item.id, item.qty)
                                  }
                                  className="w-12 bg-white border border-gray-300 rounded text-center font-bold text-sm focus:ring-1 focus:ring-blue-500 outline-none p-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
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
                                Materials (for {item.qty}{" "}
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
                                            {String(baySize).includes('"')
                                              ? ""
                                              : isSlotted
                                                ? "'"
                                                : '"'}{" "}
                                            x {getDimLabel("breadth")}" Plates
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
                                        {getDimLabel("height")}
                                        {item.dimensions.height === "custom"
                                          ? '"'
                                          : "ft"}{" "}
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
                                        {getDimVal("breadth") + 0.75}" Brackets
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
                                              {WALL_STOPPER_MAP[baySize] ||
                                                baySize}
                                              {String(baySize).includes('"')
                                                ? ""
                                                : "ft"}
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
                                        {getBayLabel(item.bays[0])} x{" "}
                                        {getDimLabel("height")}
                                        {item.dimensions.height === "custom"
                                          ? '"'
                                          : "ft"}{" "}
                                        Back Cladding
                                      </span>
                                      <strong className="text-gray-800">
                                        {1 * item.qty} pc
                                      </strong>
                                    </li>
                                    <li className="flex justify-between">
                                      <span>
                                        {getDimLabel("breadth")}" x{" "}
                                        {getDimLabel("height")}
                                        {item.dimensions.height === "custom"
                                          ? '"'
                                          : "ft"}{" "}
                                        Side Cladding
                                      </span>
                                      <strong className="text-gray-800">
                                        {2 * item.qty} pc
                                      </strong>
                                    </li>
                                    {(item.dimensions.columns > 1 ||
                                      item.dimensions.useCustomColumns) && (
                                        <li className="flex justify-between">
                                          <span>
                                            {getDimLabel("breadth")}" D x{" "}
                                            {(
                                              ((item.dimensions.height ===
                                                "custom"
                                                ? getDimVal("height")
                                                : getDimVal("height") * 12) -
                                                3) /
                                              Math.max(1, item.shelvesPerRack - 1)
                                            ).toFixed(1)}
                                            " H Dividers
                                          </span>
                                          <strong className="text-gray-900">
                                            {getPigeonDividersCount()} pc
                                          </strong>
                                        </li>
                                      )}
                                    {item.dimensions.hasStopper && (
                                      <li className="flex justify-between">
                                        <span>
                                          {getBayLabel(item.bays[0])} x 3"
                                          Stoppers
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
                                        {getPigeonBoltsCount()} pc
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
                                    const totalGondolaPlates =
                                      item.shelvesPerRack * mult * item.qty;
                                    const totalGondolaBrackets =
                                      totalGondolaPlates * 2;

                                    return (
                                      <>
                                        <li className="flex justify-between">
                                          <span>
                                            {getDimLabel("height")}
                                            {item.dimensions.height === "custom"
                                              ? '"'
                                              : "ft"}{" "}
                                            Stands (
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
                                            {getBayLabel(item.bays[0])} Bottom
                                            Base Decks
                                          </span>
                                          <strong className="text-gray-800">
                                            {mult * item.qty} pc
                                          </strong>
                                        </li>
                                        <li className="flex justify-between">
                                          <span>
                                            {getBayLabel(item.bays[0])} x{" "}
                                            {getDimLabel("breadth")}" Plates (
                                            {item.dimensions.plateGauge}
                                            G)
                                          </span>
                                          <strong className="text-gray-800">
                                            {totalGondolaPlates} pc
                                          </strong>
                                        </li>
                                        <li className="flex justify-between">
                                          <span>
                                            {getDimVal("breadth") + 0.75}"
                                            Brackets
                                          </span>
                                          <strong className="text-gray-800">
                                            {totalGondolaBrackets} pc
                                          </strong>
                                        </li>
                                        <li className="flex justify-between">
                                          <span>
                                            {getBayLabel(item.bays[0])} x{" "}
                                            {getDimLabel("height")}
                                            {item.dimensions.height === "custom"
                                              ? '"'
                                              : "ft"}{" "}
                                            Cladding
                                          </span>
                                          <strong className="text-gray-800">
                                            {mult * item.qty} pc
                                          </strong>
                                        </li>
                                        {item.dimensions.hasStopper && (
                                          <li className="flex justify-between">
                                            <span>
                                              {getBayLabel(item.bays[0])} Front
                                              Stoppers
                                            </span>
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
                    <ListChecks className="w-5 h-5 text-gray-600" />
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
                                  handleOverrideChange(
                                    item.label,
                                    e.target.value,
                                  )
                                }
                                className={`w-16 bg-white border rounded p-1 text-right focus:ring-1 focus:ring-blue-500 outline-none ${overrides[item.label] !== undefined ? "border-orange-400 text-orange-600 font-bold bg-orange-50" : "border-gray-300 text-gray-800"}`}
                              />
                            </li>
                          ),
                        )}
                        <div className="border-t border-blue-100 my-2"></div>
                        <li className="flex justify-between items-center">
                          <span className="text-gray-700 text-xs">
                            Nut/Bolts
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={quote.slotted.bolts}
                            onChange={(e) =>
                              handleOverrideChange(
                                "slottedBolts",
                                e.target.value,
                              )
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
                          <span className="text-gray-700 text-xs">
                            Nut/Bolts
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={quote.pigeon.bolts}
                            onChange={(e) =>
                              handleOverrideChange(
                                "pigeonBolts",
                                e.target.value,
                              )
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
                              handleOverrideChange(
                                "pigeonBushes",
                                e.target.value,
                              )
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
                </div>
              </div>
            )}

            {/* --- SERVICE & LOGISTICS BLOCK --- */}
            {quote && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6 animate-in fade-in">
                <div className="bg-gray-50 p-4 border-b border-gray-200">
                  <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                    <Truck className="w-4 h-4 text-gray-600" /> Fitting &
                    Delivery
                  </h2>
                </div>
                <div className="p-4 space-y-4 text-sm">
                  <ul className="space-y-3">
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
                            Pigeon Rack Fitting (Total)
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 font-medium">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={pigeonFittingCharge}
                              onChange={(e) =>
                                setPigeonFittingCharge(e.target.value)
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
                        Delivery
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
                  </ul>
                </div>
              </div>
            )}

            {/* --- REMARKS / NOTES EDITOR --- */}
            {quote && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden mt-6 animate-in fade-in">
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
                  Notes
                </h2>
                <textarea
                  value={quotationNote}
                  onChange={(e) => setQuotationNote(e.target.value)}
                  placeholder="Terms, delivery, instructions..."
                  className="w-full border-gray-300 rounded-lg shadow-sm p-3 border focus:ring-1 focus:ring-teal-500 outline-none text-sm min-h-[80px] resize-y text-gray-700"
                />
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
                    Material Estimate & Layout
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
                    Layout
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
                    Item Details
                  </h3>
                  {(() => {
                    let snapshotGrandTotal = 0;

                    const renderSnapshotItem = (
                      originalLabel,
                      qty,
                      baseRate,
                      baseTotal,
                      unit = "pc",
                    ) => {
                      if (qty > 0) {
                        const custom = invoiceOverrides[originalLabel] || {};
                        const displayLabel =
                          custom.label !== undefined
                            ? custom.label
                            : originalLabel;
                        const inclusiveRate =
                          custom.rate !== undefined ? custom.rate : baseRate;
                        const inclusiveTotal = inclusiveRate * qty;

                        snapshotGrandTotal += inclusiveTotal;

                        const multiplier = applyMarkup ? 1.09 : 1;
                        const rawCatalogPrice = inclusiveRate / multiplier;

                        const divisor = applyMarkup ? 1.18 : 1;
                        const baseRateVal = inclusiveRate / divisor;
                        const baseTotalVal = inclusiveTotal / divisor;
                        const showInput = isEditInvoiceMode && !isCapturing;

                        return (
                          <li
                            key={`snap-item-${originalLabel}`}
                            className="flex sm:flex-row justify-between items-start sm:items-center border-b border-gray-800/50 py-1.5 gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              {showInput ? (
                                <input
                                  type="text"
                                  value={displayLabel}
                                  onChange={(e) =>
                                    handleInvoiceOverride(
                                      originalLabel,
                                      "label",
                                      e.target.value,
                                    )
                                  }
                                  className="bg-gray-800 border border-dashed border-amber-500/60 rounded px-2 py-0.5 text-xs text-amber-300 outline-none w-full max-w-[220px] focus:border-amber-400 font-medium"
                                />
                              ) : (
                                <span className="text-gray-200 leading-tight block">
                                  {displayLabel.includes(" - ") ? (
                                    <>
                                      {displayLabel.split(" - ")[0]}
                                      <span className="block text-[10px] text-blue-400 font-bold italic">
                                        — {displayLabel.split(" - ")[1]}
                                      </span>
                                    </>
                                  ) : (
                                    displayLabel
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 font-mono text-xs whitespace-nowrap self-end sm:self-center">
                              {[
                                "Gondola Fitting",
                                "Pigeon Hole Fitting",
                                "Delivery Charges",
                              ].includes(originalLabel) ? (
                                showInput ? (
                                  <>
                                    <span className="text-amber-300">₹</span>
                                    <input
                                      type="number"
                                      value={
                                        rawCatalogPrice === 0
                                          ? ""
                                          : parseFloat(
                                            rawCatalogPrice.toFixed(2),
                                          )
                                      }
                                      onChange={(e) =>
                                        handleInvoiceOverride(
                                          originalLabel,
                                          "rate",
                                          (parseFloat(e.target.value) || 0) *
                                          multiplier,
                                        )
                                      }
                                      className="bg-gray-800 border border-dashed border-amber-500/60 rounded px-1.5 py-0.5 text-xs text-amber-300 text-right outline-none w-16 focus:border-amber-400 font-semibold"
                                    />
                                  </>
                                ) : (
                                  <strong className="text-white inline-block w-16 text-right">
                                    ₹{Math.round(baseTotalVal * 100) / 100}
                                  </strong>
                                )
                              ) : (
                                <>
                                  <span className="text-gray-400">
                                    {qty}
                                    {unit} * ₹
                                  </span>
                                  {showInput ? (
                                    <input
                                      type="number"
                                      value={
                                        rawCatalogPrice === 0
                                          ? ""
                                          : parseFloat(
                                            rawCatalogPrice.toFixed(2),
                                          )
                                      }
                                      onChange={(e) =>
                                        handleInvoiceOverride(
                                          originalLabel,
                                          "rate",
                                          (parseFloat(e.target.value) || 0) *
                                          multiplier,
                                        )
                                      }
                                      className="bg-gray-800 border border-dashed border-amber-500/60 rounded px-1.5 py-0.5 text-xs text-amber-300 text-right outline-none w-16 focus:border-amber-400 font-semibold"
                                    />
                                  ) : (
                                    <span className="text-gray-300">
                                      {Math.round(baseRateVal * 100) / 100}
                                    </span>
                                  )}
                                  <span className="text-gray-400"> = </span>
                                  <strong className="text-white inline-block w-16 text-right">
                                    ₹{Math.round(baseTotalVal * 100) / 100}
                                  </strong>
                                </>
                              )}
                            </div>
                          </li>
                        );
                      }
                      return null;
                    };

                    return (
                      <>
                        <ul className="space-y-2 text-[14px] text-gray-200">
                          {/* PRINT SLOTTED PARTS */}
                          {quote.slotted.hasItems && (
                            <>
                              <li className="text-blue-400 text-xs font-bold uppercase mt-4 mb-1 border-b border-gray-700 pb-1">
                                Slotted Angle Rack
                              </li>
                              {quote.slotted.plates.map((item) =>
                                renderSnapshotItem(
                                  item.label,
                                  item.qty,
                                  item.unitPrice,
                                  item.total,
                                ),
                              )}
                              {quote.slotted.angles.map((item) =>
                                renderSnapshotItem(
                                  item.label,
                                  item.qty,
                                  item.unitPrice,
                                  item.total,
                                ),
                              )}
                              {renderSnapshotItem(
                                "Nut/Bolts",
                                quote.slotted.bolts,
                                quote.hardwarePrices.bolt,
                                quote.slotted.bolts * quote.hardwarePrices.bolt,
                              )}
                              {renderSnapshotItem(
                                "Corner Supports",
                                quote.slotted.corners,
                                quote.hardwarePrices.corner,
                                quote.slotted.corners *
                                quote.hardwarePrices.corner,
                              )}
                              {renderSnapshotItem(
                                "Rubber Bushes",
                                quote.slotted.bushes,
                                quote.hardwarePrices.bush,
                                quote.slotted.bushes *
                                quote.hardwarePrices.bush,
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
                              ].map((item) =>
                                renderSnapshotItem(
                                  item.label,
                                  item.qty,
                                  item.unitPrice,
                                  item.total,
                                ),
                              )}
                              {renderSnapshotItem(
                                "Nut/Bolts",
                                quote.pigeon.bolts,
                                quote.hardwarePrices.bolt,
                                quote.pigeon.bolts * quote.hardwarePrices.bolt,
                              )}
                              {renderSnapshotItem(
                                "Corner Supports",
                                quote.pigeon.corners,
                                quote.hardwarePrices.corner,
                                quote.pigeon.corners *
                                quote.hardwarePrices.corner,
                              )}
                              {renderSnapshotItem(
                                "Rubber Bushes",
                                quote.pigeon.bushes,
                                quote.hardwarePrices.bush,
                                quote.pigeon.bushes * quote.hardwarePrices.bush,
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
                              ].map((item) =>
                                renderSnapshotItem(
                                  item.label,
                                  item.qty,
                                  item.unitPrice,
                                  item.total,
                                ),
                              )}
                              {renderSnapshotItem(
                                "Rubber Buffers",
                                quote.gondola.buffers,
                                quote.hardwarePrices.buffer,
                                quote.gondola.buffers *
                                quote.hardwarePrices.buffer,
                              )}
                            </>
                          )}

                          {/* PRINT WALL MOUNTED PARTS */}
                          {quote.wall.hasItems && (
                            <>
                              <li className="text-indigo-400 text-xs font-bold uppercase mt-4 mb-1 border-b border-gray-700 pb-1">
                                Wall Mounted Rack
                              </li>
                              {[
                                ...quote.wall.plates,
                                ...quote.wall.channels,
                                ...quote.wall.brackets,
                                ...quote.wall.stoppers,
                              ].map((item) =>
                                renderSnapshotItem(
                                  item.label,
                                  item.qty,
                                  item.unitPrice,
                                  item.total,
                                ),
                              )}
                              {renderSnapshotItem(
                                "Screws",
                                quote.wall.screws,
                                quote.hardwarePrices.screw,
                                quote.wall.screws * quote.hardwarePrices.screw,
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
                                  Charges
                                </li>

                                {quote.charges.sFittingCost > 0 &&
                                  renderSnapshotItem(
                                    "Slotted Fitting",
                                    quote.charges.totalSlottedPlates,
                                    quote.charges.sFittingRate,
                                    quote.charges.sFittingCost,
                                    " plate",
                                  )}
                                {quote.charges.wFittingCost > 0 &&
                                  renderSnapshotItem(
                                    "Wall Fitting",
                                    quote.charges.totalWallChannels,
                                    quote.charges.wFittingRate,
                                    quote.charges.wFittingCost,
                                    " ch.",
                                  )}
                                {quote.charges.pFittingCost > 0 &&
                                  renderSnapshotItem(
                                    "Pigeon Hole Fitting",
                                    1,
                                    quote.charges.pFittingCost,
                                    quote.charges.pFittingCost,
                                    " Job",
                                  )}
                                {quote.charges.gFittingCost > 0 &&
                                  renderSnapshotItem(
                                    "Gondola Fitting",
                                    1,
                                    quote.charges.gFittingCost,
                                    quote.charges.gFittingCost,
                                    " Job",
                                  )}
                                {quote.charges.rentCost > 0 &&
                                  renderSnapshotItem(
                                    "Delivery Charges",
                                    1,
                                    quote.charges.rentCost,
                                    quote.charges.rentCost,
                                    " Job",
                                  )}
                              </>
                            )}
                        </ul>

                        <div className="pt-2 mt-6">
                          {/* GST */}
                          {applyMarkup && (
                            <div className="flex justify-between items-end px-4 py-2 text-gray-300">
                              <span className="text-sm">GST (18%)</span>
                              <span className="font-mono text-sm">
                                ₹
                                {(
                                  Math.round(
                                    (snapshotGrandTotal -
                                      snapshotGrandTotal / 1.18) *
                                    100,
                                  ) / 100
                                ).toLocaleString("en-IN")}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-end bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <span className="text-lg font-medium text-gray-300">
                              Grand Total:
                            </span>
                            <span className="text-3xl font-bold text-green-400">
                              ₹
                              {Math.round(snapshotGrandTotal).toLocaleString(
                                "en-IN",
                              )}
                            </span>
                          </div>
                        </div>
                      </>
                    );
                  })()}

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
                {/* WhatsApp Section */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-4">
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                    Send via WhatsApp
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
                        className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-lg font-medium"
                        maxLength={10}
                      />
                    </div>

                    {/* DIRECT WHATSAPP BUTTON */}
                    <button
                      onClick={handleWhatsAppShare}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51h-.57c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                      Send WhatsApp
                    </button>
                  </div>
                </div>

                {/* ─── SHARE ACTIONS ROW ─────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Share as Image */}
                  <button
                    onClick={handleShareSnapshot}
                    disabled={isCapturing || isWhatsappPDF}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm border border-gray-700"
                  >
                    <Share2 className="w-4 h-4 shrink-0" />
                    {isCapturing ? "Capturing..." : "Share Image"}
                  </button>

                  {/* Share as PDF */}
                  <button
                    onClick={handleWhatsAppPDF}
                    disabled={isCapturing || isWhatsappPDF}
                    className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm border border-green-600"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {isWhatsappPDF ? "Generating PDF..." : "Share as PDF"}
                  </button>
                </div>

                {/* Helper hint */}
                {isWhatsappPDF && (
                  <p className="text-center text-xs text-gray-400 animate-pulse">
                    📄 Generating high-resolution PDF — this may take a moment…
                  </p>
                )}

                {/* CUSTOMER INFO BLOCK */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 space-y-4">
                  <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-2 flex items-center gap-2">
                    Billing Details (For PDF Invoice)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Customer Name */}
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                        Customer / Company Name
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      />
                    </div>

                    {/* GST Number */}
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                        GST Number
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="24XXXXXXXXXXXXX"
                          value={customerGst}
                          onChange={(e) => {
                            setCustomerGst(e.target.value.toUpperCase());
                            setGstError(""); // Clear error on type
                          }}
                          className={`w-full border ${gstError ? "border-red-500" : "border-gray-300"} rounded-md p-2.5 focus:ring-2 focus:ring-blue-500 outline-none uppercase text-sm font-mono`}
                          maxLength={15}
                        />
                        <button
                          onClick={handleFetchGst}
                          disabled={!customerGst || isFetchingGst}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[120px] justify-center"
                        >
                          {isFetchingGst ? (
                            <RefreshCcw className="w-4 h-4 animate-spin" />
                          ) : (
                            "Fetch Details"
                          )}
                        </button>
                      </div>
                      {gstError && (
                        <p className="text-red-500 text-xs mt-1">{gstError}</p>
                      )}
                    </div>
                  </div>

                  {/* Customer Address */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                      Billing Address
                    </label>
                    <textarea
                      placeholder="Full address for invoice..."
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      rows="2"
                      className="w-full border border-gray-300 rounded-md p-2.5 focus:ring-2 focus:ring-blue-500 outline-none resize-y text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={() => window.print()}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2 text-lg mt-4"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    ></path>
                  </svg>
                  Download PDF / Print
                </button>
                {/* NEW: Direct PDF Share Button */}
                <button
                  onClick={handleSharePDF}
                  disabled={isGeneratingPDF || isCapturing}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2 text-lg mt-4"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    ></path>
                  </svg>
                  {isGeneratingPDF ? "Creating..." : "Share PDF"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* ========================================== */}
      {/* LIVE INTERACTIVE A4 PDF LETTERHEAD         */}
      {/* ========================================== */}
      <div className="mt-12 pt-8 border-t border-gray-200 print:mt-0 print:pt-0 print:border-none">
        {/* Editor Title (Hidden in PDF) */}
        <div className="text-center mb-6 print:hidden">
          <h2 className="text-2xl font-bold text-gray-800">
            Live Invoice Preview
          </h2>
          <p className="text-gray-500 mb-4">
            Customize item names, rates, and values for the final quotation
            print/share.
          </p>

          <div className="flex flex-col items-center gap-3">
            <div className="flex justify-center items-center gap-3">
              <button
                onClick={() => setIsEditInvoiceMode(!isEditInvoiceMode)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all duration-200 border ${isEditInvoiceMode
                    ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300"
                    : "bg-white hover:bg-gray-50 text-gray-700 border-gray-300 hover:border-gray-400"
                  }`}
              >
                <span>
                  {isEditInvoiceMode
                    ? "💾 Lock Rates & Save"
                    : "✏️ Edit Invoice Rates / Names"}
                </span>
              </button>

              {Object.keys(invoiceOverrides).length > 0 && (
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to reset all custom description and rate overrides back to defaults?",
                      )
                    ) {
                      setInvoiceOverrides({});
                    }
                  }}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-sm font-bold shadow-sm transition-all duration-200"
                >
                  <span>🔄 Reset Edits</span>
                </button>
              )}
            </div>

            {isEditInvoiceMode && (
              <div className="mt-2 max-w-xl p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
                <span>
                  💡 <strong>Edit Mode Active:</strong> Click on any Item
                  Description or Rate in the table below to customize it.
                  Changes will reflect instantly on the grand total and
                  generated PDF.
                </span>
              </div>
            )}
          </div>
        </div>
        {/* Responsive Scroll Wrapper */}
        <div className="w-full overflow-x-auto pb-6 print:overflow-visible flex justify-start lg:justify-center custom-scrollbar">
          <div
            id="printable-letterhead"
            ref={letterheadRef}
            className="bg-white text-black p-8 font-sans w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none"
          >
            {/* Header */}
            <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
              <h1 className="text-3xl font-extrabold tracking-wide text-gray-900 mb-1">
                VARUN ENTERPRISE
              </h1>
              <p className="text-sm text-gray-700">
                140, Kamal Park, Part-2, Near LittleFlower School,
              </p>
              <p className="text-sm text-gray-700">
                Near Ice Factory, Kapodra, Varachha Road, Surat - 395006
              </p>
              <p className="text-sm font-bold mt-1">
                M: 9724703241 | 9824101301
              </p>
              <p className="text-sm font-bold">GST No: 24ACZPMO900A1ZZ</p>
            </div>

            <h2 className="text-center text-xl font-bold mb-6">Quotation</h2>

            {/* Meta Info */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="mt-2">
                  <p className="font-bold text-sm">Customer Details:</p>
                  <p className="text-sm font-bold uppercase">
                    {customerName || "_______________________"}
                  </p>
                  <p className="text-sm w-64 whitespace-pre-wrap">
                    {customerAddress ||
                      "_______________________\n_______________________"}
                  </p>
                  <p className="text-sm mt-1 font-bold">
                    GST No: {customerGst || "_________________"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">
                  Date: {new Date().toLocaleDateString("en-IN")}
                </p>
              </div>
            </div>

            {/* Quotation Table */}
            <table className="w-full text-sm border-collapse border border-gray-800 mb-6">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-800 p-2 text-left w-12">
                    Sr.
                  </th>
                  <th className="border border-gray-800 p-2 text-left">
                    Item Description
                  </th>
                  <th className="border border-gray-800 p-2 text-right">Qty</th>
                  <th className="border border-gray-800 p-2 text-right">
                    Rate
                  </th>
                  <th className="border border-gray-800 p-2 text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Map over all items (This assumes you flatten your quote items. Here is a simplified loop) */}
                {quote &&
                  (() => {
                    let srNo = 1;
                    let runningGrandTotal = 0; // NEW: Tracks real-time edits
                    const rows = [];

                    const addRow = (
                      originalLabel,
                      qty,
                      baseRate,
                      baseTotal,
                      unit = "Pc",
                    ) => {
                      if (qty > 0) {
                        // Look up if you've typed any custom overrides for this item
                        const custom = invoiceOverrides[originalLabel] || {};
                        const displayLabel =
                          custom.label !== undefined
                            ? custom.label
                            : originalLabel;

                        // This is the inclusive rate used for the final Grand Total math
                        const inclusiveRate =
                          custom.rate !== undefined ? custom.rate : baseRate;
                        const inclusiveTotal = inclusiveRate * qty;

                        runningGrandTotal += inclusiveTotal; // Add to final total

                        const multiplier = applyMarkup ? 1.09 : 1;
                        const rawCatalogPrice = inclusiveRate / multiplier;

                        // NEW: Conditionally Calculate Base Rate (Divide by 1.18 ONLY if markup is applied)
                        const divisor = applyMarkup ? 1.18 : 1;
                        const baseRateVal = inclusiveRate / divisor;
                        const baseTotalVal = inclusiveTotal / divisor;
                        const showInput = isEditInvoiceMode && !isGeneratingPDF;
                        const isServiceCharge = [
                          "Gondola Fitting",
                          "Pigeon Hole Fitting",
                          "Delivery Charges",
                        ].includes(originalLabel);

                        rows.push(
                          <tr key={`row-${srNo}`}>
                            <td className="border border-gray-800 p-2 text-center">
                              {srNo}
                            </td>

                            {/* EDITABLE ITEM DESCRIPTION */}
                            <td className="border border-gray-800 p-1">
                              <input
                                type="text"
                                value={displayLabel}
                                onChange={(e) =>
                                  handleInvoiceOverride(
                                    originalLabel,
                                    "label",
                                    e.target.value,
                                  )
                                }
                                className={`w-full px-2 py-1 outline-none transition-colors border rounded font-semibold text-black ${showInput
                                    ? "bg-amber-50 hover:bg-amber-100 focus:bg-amber-200 border-dashed border-amber-400"
                                    : "hidden border-transparent bg-transparent"
                                  } print:hidden`}
                              />
                              <span
                                className={`px-2 py-1 ${!showInput ? "block" : "hidden"} print:block`}
                              >
                                {displayLabel}
                              </span>
                            </td>

                            <td className="border border-gray-800 p-2 text-right">
                              {isServiceCharge ? "" : `${qty} ${unit}`}
                            </td>

                            {/* EDITABLE RATE (Shows Raw Catalog Price conditionally) */}
                            <td className="border border-gray-800 p-1 text-right">
                              <input
                                type="number"
                                value={
                                  rawCatalogPrice === 0
                                    ? ""
                                    : parseFloat(rawCatalogPrice.toFixed(2))
                                }
                                // Multiply by multiplier when typing to store the correct inclusive rate
                                onChange={(e) =>
                                  handleInvoiceOverride(
                                    originalLabel,
                                    "rate",
                                    (parseFloat(e.target.value) || 0) *
                                    multiplier,
                                  )
                                }
                                className={`w-full px-2 py-1 outline-none transition-colors border rounded font-semibold text-black text-right ${showInput
                                    ? "bg-amber-50 hover:bg-amber-100 focus:bg-amber-200 border-dashed border-amber-400"
                                    : "hidden border-transparent bg-transparent"
                                  } print:hidden`}
                              />
                              <span
                                className={`px-2 py-1 ${!showInput && !isServiceCharge ? "block" : "hidden"} print:${isServiceCharge ? "hidden" : "block"}`}
                              >
                                {!isServiceCharge &&
                                  baseRateVal.toLocaleString("en-IN", {
                                    maximumFractionDigits: 2,
                                  })}
                              </span>
                            </td>

                            {/* AUTO-UPDATING TOTAL (Shows Base Total conditionally) */}
                            <td className="border border-gray-800 p-2 text-right font-medium">
                              {baseTotalVal.toLocaleString("en-IN", {
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>,
                        );
                        srNo++;
                      }
                    };

                    // ... (KEEP ALL YOUR quote.slotted.forEach, quote.wall.forEach blocks EXACTLY the same here) ...
                    // ==========================================
                    // 1. SLOTTED RACK ITEMS
                    // ==========================================
                    if (quote.slotted.hasItems) {
                      quote.slotted.plates.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      quote.slotted.angles.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      addRow(
                        "Nut/Bolts",
                        quote.slotted.bolts,
                        quote.hardwarePrices.bolt,
                        quote.slotted.bolts * quote.hardwarePrices.bolt,
                      );
                      addRow(
                        "Corner Plates",
                        quote.slotted.corners,
                        quote.hardwarePrices.corner,
                        quote.slotted.corners * quote.hardwarePrices.corner,
                      );
                      addRow(
                        "Rubber Bushes",
                        quote.slotted.bushes,
                        quote.hardwarePrices.bush,
                        quote.slotted.bushes * quote.hardwarePrices.bush,
                      );
                    }

                    // ==========================================
                    // 2. PIGEON HOLE RACK ITEMS
                    // ==========================================
                    if (quote.pigeon.hasItems) {
                      quote.pigeon.plates.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      quote.pigeon.angles.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      quote.pigeon.cladding.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      quote.pigeon.dividers.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      quote.pigeon.stoppers.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      addRow(
                        "Nut/Bolts",
                        quote.pigeon.bolts,
                        quote.hardwarePrices.bolt,
                        quote.pigeon.bolts * quote.hardwarePrices.bolt,
                      );
                      addRow(
                        "Corner Plates",
                        quote.pigeon.corners,
                        quote.hardwarePrices.corner,
                        quote.pigeon.corners * quote.hardwarePrices.corner,
                      );
                      addRow(
                        "Rubber Bushes",
                        quote.pigeon.bushes,
                        quote.hardwarePrices.bush,
                        quote.pigeon.bushes * quote.hardwarePrices.bush,
                      );
                    }

                    // ==========================================
                    // 3. WALL MOUNTED RACK ITEMS
                    // ==========================================
                    if (quote.wall.hasItems) {
                      quote.wall.plates.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      quote.wall.channels.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      quote.wall.brackets.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      quote.wall.stoppers.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      addRow(
                        "Screws",
                        quote.wall.screws,
                        quote.hardwarePrices.screw,
                        quote.wall.screws * quote.hardwarePrices.screw,
                      );
                    }

                    // ==========================================
                    // 4. GONDOLA RACK ITEMS
                    // ==========================================
                    if (quote.gondola.hasItems) {
                      quote.gondola.stands.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      quote.gondola.bottoms.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      quote.gondola.plates.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      quote.gondola.brackets.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      quote.gondola.cladding.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      quote.gondola.stoppers.forEach((item) =>
                        addRow(
                          item.label,
                          item.qty,
                          item.unitPrice,
                          item.total,
                        ),
                      );
                      addRow(
                        "Rubber Buffers",
                        quote.gondola.buffers,
                        quote.hardwarePrices.buffer,
                        quote.gondola.buffers * quote.hardwarePrices.buffer,
                      );
                    }

                    // ==========================================
                    // 5. SERVICES, FITTING & LOGISTICS
                    // ==========================================
                    if (quote.charges.sFittingCost > 0)
                      addRow(
                        "Slotted Fitting",
                        quote.charges.totalSlottedPlates,
                        quote.charges.sFittingRate,
                        quote.charges.sFittingCost,
                      );
                    if (quote.charges.wFittingCost > 0)
                      addRow(
                        "Wall Rack Fitting",
                        quote.charges.totalWallChannels,
                        quote.charges.wFittingRate,
                        quote.charges.wFittingCost,
                      );
                    if (quote.charges.pFittingCost > 0)
                      addRow(
                        "Pigeon Hole Fitting",
                        1,
                        quote.charges.pFittingCost,
                        quote.charges.pFittingCost,
                        "Job",
                      );
                    if (quote.charges.gFittingCost > 0)
                      addRow(
                        "Gondola Fitting",
                        1,
                        quote.charges.gFittingCost,
                        quote.charges.gFittingCost,
                        "Job",
                      );

                    if (quote.charges.rentCost > 0)
                      addRow(
                        "Delivery Charges",
                        1,
                        quote.charges.rentCost,
                        quote.charges.rentCost,
                        "Job",
                      );

                    // Taxes
                    const subTotal =
                      runningGrandTotal / (applyMarkup ? 1.18 : 1); // Reverse engineer subtotal if markup exists
                    const taxAmount = applyMarkup
                      ? runningGrandTotal - subTotal
                      : 0;

                    if (applyMarkup) {
                      rows.push(
                        <tr key="tax-row">
                          <td className="border border-gray-800 p-2"></td>
                          <td className="border border-gray-800 p-2 font-bold">
                            GST
                          </td>
                          <td className="border border-gray-800 p-2"></td>
                          <td className="border border-gray-800 p-2 text-right">
                            18%
                          </td>
                          <td className="border border-gray-800 p-2 text-right font-medium">
                            {(Math.round(taxAmount * 100) / 100).toLocaleString(
                              "en-IN",
                            )}
                          </td>
                        </tr>,
                      );
                    }
                    // LIVE GRAND TOTAL ROW
                    rows.push(
                      <tr key="grand-total" className="bg-gray-100">
                        <td
                          colSpan="4"
                          className="border border-gray-800 p-2 text-right font-bold text-lg"
                        >
                          Grand Total
                        </td>
                        <td className="border border-gray-800 p-2 text-right font-bold text-lg">
                          ₹
                          {Math.round(runningGrandTotal).toLocaleString(
                            "en-IN",
                          )}
                        </td>
                      </tr>,
                    );
                    return rows;
                  })()}
              </tbody>
            </table>

            {/* Terms & Conditions */}
            <div className="mt-8">
              <h3 className="font-bold underline mb-2">Note:</h3>
              {/* Replaced <ol> with a standard div and Flexbox rows */}
              <div className="text-sm space-y-1 text-gray-700 flex gap-2 items-start">
                <span>
                  40% Advance Payment at the time of confirming order and
                  remaining 60% before delivery.
                </span>
              </div>
              {quotationNote && (
                <div className="flex gap-2 items-start font-bold text-black mt-2">
                  <span className="whitespace-pre-wrap">{quotationNote}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RackConfigurator;
