export interface DistrictLocationData {
  district: string;
  mandals: {
    mandal: string;
    villages: string[];
  }[];
}

export interface CustomLocation {
  id?: string;
  district: string;
  mandal: string;
  village: string;
  userId?: string;
  createdAt?: any;
}

export const AP_LOCATIONS: DistrictLocationData[] = [
  {
    district: "Anakapalli",
    mandals: [
      {
        mandal: "V.Madugula",
        villages: [
          "Pothanapudi Agraharam",
          "V.Madugula",
          "Jaggampeta",
          "Kinthada",
          "Madugula",
          "M.Kothapalli",
          "Goruvanipalem",
          "Sankaram",
        ],
      },
      {
        mandal: "Cheedikada",
        villages: [
          "Cheedikada",
          "Appalarajupuram",
          "Dibidi",
          "Jayamangalam",
          "Konam",
          "Lakkavaram",
          "Vechalam",
        ],
      },
      {
        mandal: "Chodavaram",
        villages: [
          "Chodavaram",
          "Govada",
          "Gajuwaka Agraharam",
          "Jangalapalle",
          "Lakkavaram",
          "Vaddadi",
        ],
      },
      {
        mandal: "Anakapalli",
        villages: [
          "Anakapalli Town",
          "Bowluwada",
          "Gaviravaram",
          "Koduru",
          "Marturu",
          "Rebaka",
          "Thotada",
        ],
      },
      {
        mandal: "Kothapattu / Devarapalli",
        villages: [
          "Devarapalli",
          "Kothapattu",
          "Raiwada",
          "Tarikura",
          "Tenugupudi",
        ],
      },
      {
        mandal: "Kasimkota",
        villages: [
          "Kasimkota",
          "Bayyavaram",
          "Tallapalem",
          "Cherlopalem",
          "Vedurupaka",
        ],
      },
      {
        mandal: "Yelamanchili",
        villages: [
          "Yelamanchili",
          "Etikoppaka",
          "Kokkirapalli",
          "Somalingapalem",
        ],
      },
    ],
  },
  {
    district: "Visakhapatnam",
    mandals: [
      {
        mandal: "Gajuwaka",
        villages: ["Gajuwaka", "Agnampudi", "Duvvada", "Vadlapudi"],
      },
      {
        mandal: "Pendurthi",
        villages: ["Pendurthi", "Gorapalli", "Rampuram", "Suojatanagar"],
      },
      {
        mandal: "Anandapuram",
        villages: ["Anandapuram", "Gambheeram", "Vemulavalasa"],
      },
      {
        mandal: "Bheemunipatnam",
        villages: ["Bheemunipatnam", "Thotlakonda", "Bheemili Beach Side"],
      },
      {
        mandal: "Visakhapatnam Urban",
        villages: ["Kancharapalem", "MVP Colony", "Seethammadhara", "Gopalapatnam"],
      },
    ],
  },
  {
    district: "Kakinada",
    mandals: [
      {
        mandal: "Kakinada Urban",
        villages: ["Kakinada Town", "Ramanayyapeta", "Jagannaickpur"],
      },
      {
        mandal: "Pithapuram",
        villages: ["Pithapuram", "Gollaprolu", "Chebrolu"],
      },
      {
        mandal: "Peddapuram",
        villages: ["Peddapuram", "Samalkota", "G.Ragampeta"],
      },
    ],
  },
  {
    district: "Vizianagaram",
    mandals: [
      {
        mandal: "Vizianagaram",
        villages: ["Vizianagaram Town", "Gajularega", "Kothavalasa"],
      },
      {
        mandal: "Srikakulam / Rajam",
        villages: ["Rajam", "Palakonda", "Amadalavalasa"],
      },
    ],
  },
  {
    district: "East Godavari",
    mandals: [
      {
        mandal: "Rajahmundry",
        villages: ["Rajahmundry City", "Morampudi", "Hukumpeta"],
      },
      {
        mandal: "Anaparthi",
        villages: ["Anaparthi", "Biccavolu", "Pedapudi"],
      },
    ],
  },
  {
    district: "West Godavari / Eluru",
    mandals: [
      {
        mandal: "Eluru",
        villages: ["Eluru Town", "Tangellamudi", "Sanivarapupeta"],
      },
      {
        mandal: "Bhimavaram",
        villages: ["Bhimavaram Town", "Tadepalligudem", "Tanuku"],
      },
    ],
  },
  {
    district: "NTR / Krishna",
    mandals: [
      {
        mandal: "Vijayawada",
        villages: ["Vijayawada Central", "Patamata", "Gunadala", "Gannavaram"],
      },
    ],
  },
  {
    district: "Guntur",
    mandals: [
      {
        mandal: "Guntur Urban",
        villages: ["Guntur City", "Amaravati", "Mangalagiri"],
      },
    ],
  },
];

export function getMergedLocations(customLocations: CustomLocation[]): DistrictLocationData[] {
  const result: DistrictLocationData[] = JSON.parse(JSON.stringify(AP_LOCATIONS));

  customLocations.forEach((cLoc) => {
    const distName = (cLoc.district || "").trim();
    if (!distName) return;

    let distObj = result.find((d) => d.district.toLowerCase() === distName.toLowerCase());
    if (!distObj) {
      distObj = { district: distName, mandals: [] };
      result.push(distObj);
    }

    const mandalName = (cLoc.mandal || "").trim();
    if (mandalName) {
      let mandalObj = distObj.mandals.find((m) => m.mandal.toLowerCase() === mandalName.toLowerCase());
      if (!mandalObj) {
        mandalObj = { mandal: mandalName, villages: [] };
        distObj.mandals.push(mandalObj);
      }

      const villageName = (cLoc.village || "").trim();
      if (villageName && !mandalObj.villages.some((v) => v.toLowerCase() === villageName.toLowerCase())) {
        mandalObj.villages.push(villageName);
      }
    }
  });

  return result;
}
