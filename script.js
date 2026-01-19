// Application State
const state = {
    taxType: null, // 'federal', 'indiana', or 'combined'
    filingStatus: null, // 'single', 'married', 'hoh'
    age: null, // 'under65' or '65plus'
    formType: null, // '1040' or '1040-SR'
    userName: '',
    userEmail: '',
    currentSection: 'income',
    indiana: {
        county: null,
        countyRate: 0
    },
    data: {
        income: {
            wages: 0,
            interest: 0,
            dividends: 0,
            retirement: 0,
            socialSecurity: 0,
            capitalGains: 0,
            otherIncome: 0
        },
        deductions: {
            type: 'standard',
            standardAmount: 15750,
            itemized: {
                medical: 0,
                stateTaxes: 0,
                mortgage: 0,
                charitable: 0
            }
        },
        credits: {
            childTaxCredit: 0,
            earnedIncomeCredit: 0,
            educationCredit: 0,
            federalWithholding: 0
        },
        indianaCredits: {
            rentersDeduction: 0,
            propertyTaxDeduction: 0,
            unifiedTaxCredit: 0
        }
    }
};

// Standard Deduction Chart for 2025 (Form 1040-SR)
// Based on filing status and number of boxes checked on line 12d
// NOTE: Chart starts at 1 box (age 65+ OR blind) - 0 boxes uses standard under-65 amounts
const STANDARD_DEDUCTION_CHART = {
    single: {
        0: 15750,  // Base 2025
        1: 17750,  // 15750 + 2000
        2: 19750   // 15750 + 4000
    },
    married: {
        0: 31500,  // Base 2025
        1: 33100,  // 31500 + 1600
        2: 34700,  // 31500 + 3200
        3: 36300,  // 31500 + 4800
        4: 37900   // 31500 + 6400
    },
    qss: {
        0: 31500,  // Same as MFJ
        1: 33100,
        2: 34700
    },
    hoh: {
        0: 23625,  // Base 2025
        1: 25625,  // 23625 + 2000
        2: 27625   // 23625 + 4000
    },
    mfs: {
        0: 15750,  // Base 2025
        1: 17350,  // 15750 + 1600 (Senior per box)
        2: 18950,
        3: 20550,
        4: 22150
    }
};

// 2025 IRS Tax Computation Worksheet for Line 16
// For taxable income of $100,000 or more
// Formula: (taxable income × rate) - subtraction amount = tax
const TAX_COMPUTATION_WORKSHEET = {
    single: [
        { minIncome: 100000, maxIncome: 103350, rate: 0.22, subtraction: 5086.00 },
        { minIncome: 103350, maxIncome: 197300, rate: 0.24, subtraction: 7153.00 },
        { minIncome: 197300, maxIncome: 250525, rate: 0.32, subtraction: 22937.00 },
        { minIncome: 250525, maxIncome: 626350, rate: 0.35, subtraction: 30452.75 },
        { minIncome: 626350, maxIncome: Infinity, rate: 0.37, subtraction: 42979.75 }
    ],
    married: [
        { minIncome: 100000, maxIncome: 206700, rate: 0.22, subtraction: 10172.00 },
        { minIncome: 206700, maxIncome: 394600, rate: 0.24, subtraction: 14306.00 },
        { minIncome: 394600, maxIncome: 501050, rate: 0.32, subtraction: 45874.00 },
        { minIncome: 501050, maxIncome: 751600, rate: 0.35, subtraction: 60905.50 },
        { minIncome: 751600, maxIncome: Infinity, rate: 0.37, subtraction: 75937.50 }
    ],
    qss: [
        // Qualifying Surviving Spouse uses same as Married Filing Jointly
        { minIncome: 100000, maxIncome: 206700, rate: 0.22, subtraction: 10172.00 },
        { minIncome: 206700, maxIncome: 394600, rate: 0.24, subtraction: 14306.00 },
        { minIncome: 394600, maxIncome: 501050, rate: 0.32, subtraction: 45874.00 },
        { minIncome: 501050, maxIncome: 751600, rate: 0.35, subtraction: 60905.50 },
        { minIncome: 751600, maxIncome: Infinity, rate: 0.37, subtraction: 75937.50 }
    ],
    hoh: [
        { minIncome: 100000, maxIncome: 103350, rate: 0.22, subtraction: 6825.00 },
        { minIncome: 103350, maxIncome: 197300, rate: 0.24, subtraction: 8892.00 },
        { minIncome: 197300, maxIncome: 250500, rate: 0.32, subtraction: 24676.00 },
        { minIncome: 250500, maxIncome: 626350, rate: 0.35, subtraction: 32191.00 },
        { minIncome: 626350, maxIncome: Infinity, rate: 0.37, subtraction: 44718.00 }
    ],
    mfs: [
        // Married Filing Separately
        { minIncome: 100000, maxIncome: 103350, rate: 0.22, subtraction: 5086.00 },
        { minIncome: 103350, maxIncome: 197300, rate: 0.24, subtraction: 7153.00 },
        { minIncome: 197300, maxIncome: 250525, rate: 0.32, subtraction: 22937.00 },
        { minIncome: 250525, maxIncome: 375800, rate: 0.35, subtraction: 30452.75 },
        { minIncome: 375800, maxIncome: Infinity, rate: 0.37, subtraction: 37968.75 }
    ]
};

// Calculate Federal Tax using IRS Tax Computation Worksheet
// For taxable income $100,000 and over, uses official IRS formulas
// For income under $100,000, uses marginal tax brackets
function calculateFederalTax(taxableIncome, filingStatus) {
    // For income under $100,000, calculate using marginal tax brackets
    if (taxableIncome < 100000) {
        let tax = 0;

        // 2025 Tax Brackets vary by filing status
        if (filingStatus === 'single' || filingStatus === 'mfs') {
            // Single and Married Filing Separately
            if (taxableIncome <= 11925) {
                tax = taxableIncome * 0.10;
            } else if (taxableIncome <= 48475) {
                tax = (11925 * 0.10) + ((taxableIncome - 11925) * 0.12);
            } else {
                tax = (11925 * 0.10) + ((48475 - 11925) * 0.12) + ((taxableIncome - 48475) * 0.22);
            }
        } else if (filingStatus === 'married' || filingStatus === 'qss') {
            // Married Filing Jointly and Qualifying Surviving Spouse
            if (taxableIncome <= 23850) {
                tax = taxableIncome * 0.10;
            } else if (taxableIncome <= 96950) {
                tax = (23850 * 0.10) + ((taxableIncome - 23850) * 0.12);
            } else {
                tax = (23850 * 0.10) + ((96950 - 23850) * 0.12) + ((taxableIncome - 96950) * 0.22);
            }
        } else if (filingStatus === 'hoh') {
            // Head of Household
            if (taxableIncome <= 17000) {
                tax = taxableIncome * 0.10;
            } else if (taxableIncome <= 64850) {
                tax = (17000 * 0.10) + ((taxableIncome - 17000) * 0.12);
            } else {
                tax = (17000 * 0.10) + ((64850 - 17000) * 0.12) + ((taxableIncome - 64850) * 0.22);
            }
        } else {
            // Default to single if filing status is unknown
            console.warn(`Unknown filing status: ${filingStatus}, using single brackets`);
            if (taxableIncome <= 11925) {
                tax = taxableIncome * 0.10;
            } else if (taxableIncome <= 48475) {
                tax = (11925 * 0.10) + ((taxableIncome - 11925) * 0.12);
            } else {
                tax = (11925 * 0.10) + ((48475 - 11925) * 0.12) + ((taxableIncome - 48475) * 0.22);
            }
        }

        console.log(`📊 Tax Calculation (${filingStatus}) - Under $100K:
        Taxable Income: $${taxableIncome.toLocaleString()}
        Tax: $${tax.toLocaleString()}`);

        return Math.max(0, Math.round(tax));
    }

    // For income $100,000 and over, use IRS Tax Computation Worksheet
    const worksheet = TAX_COMPUTATION_WORKSHEET[filingStatus];
    if (!worksheet) {
        console.error(`Invalid filing status: ${filingStatus}`);
        return 0;
    }

    // Find the correct bracket
    for (const bracket of worksheet) {
        if (taxableIncome >= bracket.minIncome && taxableIncome < bracket.maxIncome) {
            // Apply IRS formula: (taxable income × rate) - subtraction amount
            const tax = (taxableIncome * bracket.rate) - bracket.subtraction;
            console.log(`📊 Tax Calculation (${filingStatus}) - $100K+:
            Taxable Income: $${taxableIncome.toLocaleString()}
            Rate: ${(bracket.rate * 100)}%
            Subtraction: $${bracket.subtraction.toLocaleString()}
            Tax: $${tax.toLocaleString()}`);
            return Math.max(0, tax); // Ensure non-negative
        }
    }

    // If we get here, something went wrong
    console.error(`Could not find tax bracket for income: $${taxableIncome}`);
    return 0;
}

// AI Knowledge Base for Search
const knowledgeBase = [
    {
        title: "Line 1 - Wages, Salaries, Tips",
        content: "This is your total income from employment. New for 2025: If you are an eligible worker, you can deduct up to $25,000 in qualified tip income. Also, you may deduct the 'half' portion of overtime pay up to $12,500 ($25,000 for joint filers)."
    },
    {
        title: "Line 2b - Interest Income",
        content: "Report interest earned from savings accounts, checking accounts, CDs, bonds, and money market accounts. Your bank will send you Form 1099-INT if you earned more than $10 in interest. Add up all 1099-INT forms."
    },
    {
        title: "Line 3b - Dividends",
        content: "Dividends are payments from stocks, mutual funds, or ETFs you own. Your brokerage will send Form 1099-DIV. Only report qualified dividends here - ordinary dividends go on a different line."
    },
    {
        title: "Line 4b - Retirement Income",
        content: "Include distributions from IRAs, 401(k)s, pensions, and annuities. Not all retirement income is taxable - check your 1099-R form. Roth IRA distributions are usually tax-free if you're over 59½."
    },
    {
        title: "Line 5b - Social Security Benefits",
        content: "Only a portion of Social Security may be taxable, depending on your total income. If Social Security is your only income, it's usually not taxable. The taxable amount is calculated based on your combined income."
    },
    {
        title: "Line 7 - Capital Gains",
        content: "Profit from selling investments like stocks, bonds, or real estate. Short-term gains (held less than 1 year) are taxed as ordinary income. Long-term gains (held more than 1 year) get preferential tax rates."
    },
    {
        title: "Standard Deduction",
        content: "The standard deduction is a fixed amount that reduces your taxable income. For 2025: Single/MFS get $15,750, Married Filing Jointly get $31,500, Head of Household get $23,625. Individuals 65+ can claim an additional $6,000 ($12,000 for qualifying couples)."
    },
    {
        title: "Married Filing Jointly",
        content: "If you're married, filing jointly usually provides the best tax benefits. For 2025, the standard deduction is $31,500. If one spouse is 65+, it's $37,500; if both are 65+, it's $43,500. Tax brackets are roughly double those for single filers."
    },
    {
        title: "Head of Household",
        content: "You can file as Head of Household if you're unmarried and pay more than half the cost of a home for a qualifying person. For 2025, the standard deduction is $23,625 ($29,625 if you're 65+)."
    },
    {
        title: "Indiana State Tax",
        content: "Indiana has a flat income tax rate of 3.00% on adjusted gross income. Additionally, counties impose their own income tax ranging from about 1% to 2%. Your total Indiana tax is the state rate plus your county rate."
    },
    {
        title: "Indiana County Tax",
        content: "Each Indiana county sets its own income tax rate. Rates vary from about 1% to 2.5%. For example, Marion County (Indianapolis) is 2.02%, Howard County is 1.95%, and Hamilton County is 1.06%. This is added to the 3.00% state rate."
    },
    {
        title: "Indiana IT-40 Line 2 - Add-Backs",
        content: "Certain income items that are exempt at the federal level must be added back for Indiana tax. Examples include lump-sum distributions from qualified plans and certain educational expenses. Most taxpayers enter $0 here."
    },
    {
        title: "Indiana IT-40 Line 4 - Deductions",
        content: "Common Indiana deductions include military service pay, Social Security income, and certain retirement benefits. Indiana does not tax Social Security, so you should deduct the taxable portion reported on your federal return."
    },
    {
        title: "Indiana IT-40 Line 6 - Exemptions",
        content: "You get a standard $1,000 exemption for yourself, your spouse, and each dependent. Additional exemptions are available for individuals over 65 or who are blind ($1,000 extra) and for qualified children ($1,500 extra per child)."
    },
    {
        title: "Indiana IT-40 Line 17 - Donations",
        content: "You can choose to donate part of your refund to programs like the Indiana Wildlife Fund or the Military Family Relief Fund. Donations reduce your overpayment but do not affect your tax liability."
    },
    {
        title: "Indiana IT-40 Line 19 - Applied Refund",
        content: "Instead of receiving a refund check, you can choose to apply some or all of your overpayment to next year's (2026) estimated tax. This is helpful if you expect to owe taxes next year."
    },
    {
        title: "Itemized Deductions",
        content: "Instead of the standard deduction, you can itemize on Schedule A. For 2025, the SALT deduction cap (state and local taxes) increased to $40,000 for earners under $500k. New car loan interest up to $10,000 is also deductible (Form 1098-VLI)."
    },
    {
        title: "Child Tax Credit",
        content: "For 2025, the credit increased to $2,200 per qualifying child under 17. Additionally, 'Trump Accounts' will be established for newborns (2025-2028) with a $1,000 government deposit."
    },
    {
        title: "Earned Income Credit (EIC)",
        content: "A refundable credit for low to moderate income workers. The amount depends on your income and number of qualifying children. Even if you don't owe taxes, you can get a refund. Income limits apply."
    },
    {
        title: "Education Credits",
        content: "Two main credits: American Opportunity Credit (up to $2,500 for first 4 years of college) and Lifetime Learning Credit (up to $2,000 for any post-secondary education). You can't claim both for the same student in the same year."
    },
    {
        title: "Federal Withholding",
        content: "This is the federal income tax already taken out of your paychecks throughout the year. Find this on your W-2 in Box 2. If you had multiple jobs, add up all W-2s. This is credited against your total tax owed."
    },
    {
        title: "Form 1040 vs 1040-SR",
        content: "Form 1040-SR is designed for seniors (65+) with larger print and a standard deduction chart. It's functionally identical to Form 1040 but easier to read. If you're 65 or older, you can use either form."
    },
    {
        title: "Refund vs Amount Owed",
        content: "If your payments and credits exceed your tax liability, you get a refund. For 2025, note that Clean Vehicle tax credits expired for vehicles acquired after September 30."
    },
    {
        title: "Digital Assets (Form 1099-DA)",
        content: "Starting in 2025, cryptocurrency and other digital asset transactions must be reported using the new Form 1099-DA. This ensures standardized reporting for digital investment gains and losses."
    },
    {
        title: "Retirement Limits (2025)",
        content: "401(k) / 403(b) contribution limits increased to $23,500 ($31,000 if age 50+). IRA limits remained at $7,000 ($8,000 if age 50+). HSA limits are $4,300 (Single) and $8,550 (Family)."
    }
];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Convert all calculated fields from type="number" to type="text" to support comma formatting
    document.querySelectorAll('.calculated').forEach(field => {
        if (field.type === 'number') {
            field.type = 'text';
            field.removeAttribute('step');
        }
    });

    initializeEventListeners();
    loadSavedProgress();
});

function initializeEventListeners() {
    // Tax Type Selection
    document.querySelectorAll('.tax-type-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const taxType = e.currentTarget.dataset.taxType;
            state.taxType = taxType;

            // Set form type based on selection
            if (taxType === 'federal-1040') {
                state.formType = '1040';
            } else if (taxType === 'federal-1040sr') {
                state.formType = '1040-SR';
            } else if (taxType === 'combined') {
                state.formType = '1040'; // Default to 1040 for combined as requested
            }

            // Hide tax type selection
            document.querySelector('.tax-type-selection').style.display = 'none';

            // Show appropriate next step
            if (taxType === 'indiana') {
                // For Indiana only, show county selection first
                document.getElementById('countySelection').style.display = 'block';
            } else {
                // For federal or combined, show filing status selection
                document.getElementById('filingStatusSelection').style.display = 'block';
            }
        });
    });

    // Filing Status Selection
    document.querySelectorAll('.filing-status-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const filingStatus = e.currentTarget.dataset.filingStatus;

            state.filingStatus = filingStatus;
            // Form type will be determined by age checkboxes on line 12d
            state.formType = '1040'; // Default to 1040 for this calculator

            // Set initial standard deduction (will be recalculated based on line 12d checkboxes)
            // Start with 0 boxes checked
            state.data.deductions.standardAmount = STANDARD_DEDUCTION_CHART[filingStatus][0];

            // If combined or Indiana, show county selection
            if (state.taxType === 'combined' || state.taxType === 'indiana') {
                document.getElementById('filingStatusSelection').style.display = 'none';
                document.getElementById('countySelection').style.display = 'block';
            } else {
                // Federal only - go straight to login
                showLoginModal();
            }
        });
    });

    // County Selection
    const countySelect = document.getElementById('indianaCounty');
    const confirmCountyBtn = document.getElementById('confirmCounty');

    countySelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        if (selectedOption.value) {
            state.indiana.county = selectedOption.value;
            state.indiana.countyRate = parseFloat(selectedOption.dataset.rate);
            confirmCountyBtn.disabled = false;
        } else {
            confirmCountyBtn.disabled = true;
        }
    });

    confirmCountyBtn.addEventListener('click', () => {
        // For Indiana only, skip filing status and go straight to login
        if (state.taxType === 'indiana') {
            document.getElementById('countySelection').style.display = 'none';
            showLoginModal();
        } else if (state.taxType === 'combined' && !state.filingStatus) {
            // For combined, show filing status selection
            document.getElementById('countySelection').style.display = 'none';
            document.getElementById('filingStatusSelection').style.display = 'block';
        } else {
            // Otherwise proceed to login
            showLoginModal();
        }
    });

    // Back to Tax Type button
    const backBtn = document.getElementById('backToTaxType');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('filingStatusSelection').style.display = 'none';
            document.querySelector('.tax-type-selection').style.display = 'block';
        });
    }

    // Login modal
    document.getElementById('loginBtn').addEventListener('click', handleLogin);

    // Real-time email validation
    const emailInput = document.getElementById('userEmail');
    emailInput.addEventListener('input', validateEmailInput);
    emailInput.addEventListener('blur', validateEmailInput);

    // Navigation
    document.querySelectorAll('.milestone-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const section = e.currentTarget.dataset.section;
            navigateToSection(section);
        });
    });

    // Next section buttons
    document.querySelectorAll('[data-next]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const nextSection = e.currentTarget.dataset.next;
            navigateToSection(nextSection);
        });
    });

    // Previous section buttons
    document.querySelectorAll('[data-prev]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const prevSection = e.currentTarget.dataset.prev;
            navigateToSection(prevSection);
        });
    });

    // Back to home
    document.getElementById('backToHomeBtn').addEventListener('click', () => {
        if (confirm('Are you sure? Your progress will be saved.')) {
            saveProgress();
            resetToHome();
        }
    });

    // Save progress
    document.getElementById('saveProgressBtn').addEventListener('click', () => {
        saveProgress();
        alert('✓ Progress saved successfully!');
    });

    // AI Search
    const searchInput = document.getElementById('aiSearch');
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            document.getElementById('searchResults').classList.remove('active');
        }, 200);
    });

    // Collapsible Sections
    document.querySelectorAll('.collapsible-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            const button = e.currentTarget;
            const targetId = button.dataset.target;
            const content = document.getElementById(targetId);

            if (content.style.display === 'none') {
                content.style.display = 'block';
                button.classList.add('active');
                button.querySelector('.toggle-text').textContent = button.querySelector('.toggle-text').textContent.replace('Show', 'Hide');
            } else {
                content.style.display = 'none';
                button.classList.remove('active');
                button.querySelector('.toggle-text').textContent = button.querySelector('.toggle-text').textContent.replace('Hide', 'Show');
            }
        });
    });

    // Income inputs - Line 1 (Wages)
    ['line1a', 'line1b', 'line1c', 'line1d', 'line1e', 'line1f', 'line1g', 'line1h'].forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.addEventListener('input', () => {
                updateLine1zTotal();
                updateLine9Total();
                updateLine11aAGI();
                updateLiveSummary(); // Live summary update
                markSectionProgress('income');
            });
        }
    });

    // Line 1i Amount (combat pay)
    const line1iAmount = document.getElementById('line1iAmount');
    if (line1iAmount) {
        line1iAmount.addEventListener('input', () => {
            updateLine1zTotal();
            updateLine9Total();
            updateLine11aAGI();
            updateLiveSummary(); // Live summary update
            markSectionProgress('income');
        });
    }

    // Line 2: Interest
    ['line2a', 'line2b'].forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.addEventListener('input', () => {
                updateLine9Total();
                updateLine11aAGI();
                updateLiveSummary(); // Live summary update
                markSectionProgress('income');
            });
        }
    });

    // Line 3: Dividends
    ['line3a', 'line3b'].forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.addEventListener('input', () => {
                updateLine9Total();
                updateLine11aAGI();
                updateLiveSummary(); // Live summary update
                markSectionProgress('income');
            });
        }
    });

    // Line 4: IRA Distributions
    ['line4a', 'line4b'].forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.addEventListener('input', () => {
                updateLine9Total();
                updateLine11aAGI();
                updateLiveSummary(); // Live summary update
                markSectionProgress('income');
            });
        }
    });

    // Line 5: Pensions and Annuities
    ['line5a', 'line5b'].forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.addEventListener('input', () => {
                updateLine9Total();
                updateLine11aAGI();
                updateLiveSummary(); // Live summary update
                markSectionProgress('income');
            });
        }
    });

    // Line 6: Social Security
    ['line6a', 'line6b'].forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.addEventListener('input', () => {
                // If 6a changes, update the dynamic prompt in the tooltip
                if (field === 'line6a') {
                    updateDynamicPrompt6b(input.value);
                }
                updateLine9Total();
                updateLine11aAGI();
                updateLiveSummary(); // Live summary update
                markSectionProgress('income');
            });
        }
    });

    // Line 7: Capital Gains
    const line7 = document.getElementById('line7');
    if (line7) {
        line7.addEventListener('input', () => {
            updateLine9Total();
            updateLine11aAGI();
            markSectionProgress('income');
        });
    }

    // Line 8: Additional Income
    const line8 = document.getElementById('line8');
    if (line8) {
        line8.addEventListener('input', () => {
            updateLine9Total();
            updateLine11aAGI();
            markSectionProgress('income');
        });
    }

    // Line 10: Adjustments
    const line10 = document.getElementById('line10');
    if (line10) {
        line10.addEventListener('input', () => {
            updateLine11aAGI();
            markSectionProgress('income');
        });
    }

    // Tax and Credits Section Event Listeners

    // Line 12d: Standard Deduction Checkboxes (age 65+ and blind)
    ['line12d1', 'line12d2', 'line12dSpouse1', 'line12dSpouse2'].forEach(checkboxId => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                updateStandardDeduction();
                updateLine14TotalDeductions();
                updateLine15TaxableIncome();
                updateLine16Tax();
                updateLine18();
                updateLine22();
                updateLine24TotalTax();
                updateLiveSummary(); // Live summary update
                markSectionProgress('deductions');
            });
        }
    });

    // Line 13: QBI and Additional Deductions
    ['line13a', 'line13b'].forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.addEventListener('input', () => {
                updateLine14TotalDeductions();
                updateLine15TaxableIncome();
                updateLine16Tax();
                updateLine18();
                updateLine22();
                updateLine24TotalTax();
                updateLiveSummary(); // Live summary update
                markSectionProgress('deductions');
            });
        }
    });

    // Line 17: Additional Taxes
    const line17 = document.getElementById('line17');
    if (line17) {
        line17.addEventListener('input', () => {
            updateLine18();
            updateLine22();
            updateLine24TotalTax();
            updateLiveSummary(); // Live summary update
            markSectionProgress('deductions');
        });
    }

    // Line 19-20: Credits
    ['line19', 'line20'].forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.addEventListener('input', () => {
                updateLine21();
                updateLine22();
                updateLine24TotalTax();
                updateLiveSummary(); // Live summary update
                markSectionProgress('deductions');
            });
        }
    });

    // Line 23: Other Taxes
    const line23 = document.getElementById('line23');
    if (line23) {
        line23.addEventListener('input', () => {
            updateLine24TotalTax();
            updateLiveSummary(); // Live summary update
            markSectionProgress('deductions');
        });
    }

    // Payments Section Event Listeners

    // Lines 25a-25c: Federal Withholding
    ['line25a', 'line25b', 'line25c'].forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.addEventListener('input', () => {
                updateLine25dWithholding();
                updateLine33TotalPayments();
                updateRefundOrOwed();
                updateLiveSummary(); // Live summary update
                markSectionProgress('credits');
            });
        }
    });

    // Lines 26-31: Estimated Payments and Refundable Credits
    ['line26', 'line27', 'line28', 'line29', 'line30', 'line31'].forEach(field => {
        const input = document.getElementById(field);
        if (input) {
            input.addEventListener('input', () => {
                updateLine32OtherPayments();
                updateLine33TotalPayments();
                updateRefundOrOwed();
                updateLiveSummary(); // Live summary update
                markSectionProgress('credits');
            });
        }
    });

    // Line 35a: Refund amount (user can modify)
    const line35a = document.getElementById('line35a');
    if (line35a) {
        line35a.addEventListener('input', () => {
            // Validate that refund amount doesn't exceed overpayment
            const overpayment = getFieldValue('line34');
            const refundAmount = parseFloat(line35a.value) || 0;
            if (refundAmount > overpayment) {
                line35a.value = overpayment.toFixed(2);
            }
        });
    }

    // Line 36: Apply to 2026 estimated tax
    const line36 = document.getElementById('line36');
    if (line36) {
        line36.addEventListener('input', () => {
            // Validate that applied amount doesn't exceed overpayment
            const overpayment = getFieldValue('line34');
            const appliedAmount = parseFloat(line36.value) || 0;
            if (appliedAmount > overpayment) {
                line36.value = overpayment.toFixed(2);
            }
            // Adjust refund amount
            const refundAmount = Math.max(0, overpayment - appliedAmount);
            setFieldValue('line35a', refundAmount);
        });
    }

    // Bank account validation
    const routingNumber = document.getElementById('line35b');
    if (routingNumber) {
        routingNumber.addEventListener('input', (e) => {
            // Only allow digits
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }

    const accountNumber = document.getElementById('line35c');
    if (accountNumber) {
        accountNumber.addEventListener('input', (e) => {
            // Only allow digits
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }



    // Indiana IT-40 Event Listeners
    ['indianaLine1', 'indianaLine2', 'indianaLine4', 'indianaLine6', 'indianaLine10', 'indianaLine12', 'indianaLine13',
        'indianaLine17', 'indianaLine19', 'indianaLine20', 'indianaLine24', 'indianaLine25'].forEach(field => {
            const input = document.getElementById(field);
            if (input) {
                input.addEventListener('input', () => {
                    updateAllIndianaCalculations();
                    markSectionProgress('indiana');
                });
            }
        });

    // Summary actions
    document.querySelectorAll('.download-pdf').forEach(btn => {
        btn.addEventListener('click', generatePDF);
    });

    const preCheckBtn = document.getElementById('runPreCheckBtn');
    if (preCheckBtn) {
        preCheckBtn.addEventListener('click', runPreCheck);
    }

    // Line 6b Copy Prompt Functionality
    const copyBtn = document.getElementById('copyPrompt6b');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const promptSpan = document.getElementById('promptText6b');
            if (promptSpan) {
                const textToCopy = promptSpan.textContent;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const feedback = document.getElementById('copyFeedback6b');
                    if (feedback) {
                        feedback.style.display = 'block';
                        setTimeout(() => {
                            feedback.style.display = 'none';
                        }, 2000);
                    }
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                });
            }
        });
    }
}

function showLoginModal() {
    document.getElementById('loginModal').classList.add('active');
}

function validateEmailInput(e) {
    const emailInput = e.target;
    const email = emailInput.value.trim();
    const errorEl = document.getElementById('emailError');

    if (email === '') {
        emailInput.classList.remove('error', 'success');
        errorEl.classList.remove('active');
        return;
    }

    if (!isValidEmail(email)) {
        emailInput.classList.add('error');
        emailInput.classList.remove('success');
        errorEl.textContent = '⚠️ Please enter a valid email address (e.g., name@example.com)';
        errorEl.classList.add('active');
    } else {
        emailInput.classList.remove('error');
        emailInput.classList.add('success');
        errorEl.classList.remove('active');
    }
}

function handleLogin() {
    const firstName = document.getElementById('userFirstName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const firstNameInput = document.getElementById('userFirstName');
    const emailInput = document.getElementById('userEmail');
    const errorEl = document.getElementById('emailError');

    // Reset error states
    firstNameInput.classList.remove('error');
    emailInput.classList.remove('error');
    errorEl.classList.remove('active');

    if (!firstName) {
        firstNameInput.classList.add('error');
        firstNameInput.focus();
        alert('⚠️ Please enter your first name.');
        return;
    }

    if (!email) {
        emailInput.classList.add('error');
        emailInput.focus();
        errorEl.textContent = '⚠️ Email address is required.';
        errorEl.classList.add('active');
        return;
    }

    if (!isValidEmail(email)) {
        emailInput.classList.add('error');
        emailInput.focus();
        errorEl.textContent = '⚠️ Please enter a valid email address (e.g., name@example.com)';
        errorEl.classList.add('active');
        return;
    }

    state.userName = firstName;
    state.userEmail = email;

    // Check for saved data on the server
    loadFromServer(email);

    document.getElementById('loginModal').classList.remove('active');
    showFormPage();
}

async function loadFromServer(email) {
    try {
        console.log(`📡 Fetching saved return for: ${email}`);
        const response = await fetch(`/api/load/${encodeURIComponent(email)}`);
        
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                console.log('✅ Saved data found, rehydrating form...');
                
                // Update state
                if (result.data.data) {
                    state.data = result.data.data;
                }
                
                // Rehydrate the form inputs from the loaded data
                rehydrateForm(result.data.data);
                
                // Show a brief notification
                const notification = document.createElement('div');
                notification.className = 'save-notification';
                notification.textContent = '🏠 Welcome back! Your previous progress has been restored.';
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 5000);
            }
        }
    } catch (error) {
        console.error('Error loading data from server:', error);
    }
}

function rehydrateForm(savedData) {
    if (!savedData) return;

    // Iterate through all input elements and checkboxes
    document.querySelectorAll('input.input-field, select.county-select, input.checkbox-field, input[type="checkbox"]').forEach(el => {
        const id = el.id;
        if (!id || !savedData.hasOwnProperty(id)) return;

        const val = savedData[id];

        if (el.type === 'checkbox') {
            el.checked = !!val;
        } else {
            el.value = val;
        }
        
        // Trigger a change/input event to ensure calculations update
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Handle special cases not captured by standard iteration
    if (savedData.taxType) state.taxType = savedData.taxType;
    if (savedData.filingStatus) state.filingStatus = savedData.filingStatus;
    if (savedData.formType) state.formType = savedData.formType;
    if (savedData.userName) state.userName = savedData.userName;

    // Force recalculations
    updateLine1zTotal();
    updateLine9Total();
    updateLine11aAGI();
    updateStandardDeduction();
    updateAllTaxAndCredits();
    updateAllPayments();
    updateAllIndianaCalculations();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFormPage() {

    showPage('formPage');

    // Scroll to top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update form title based on tax type and filing status
    let formTitle = '';
    if (state.taxType === 'federal-1040') {
        formTitle = 'IRS Form 1040';
    } else if (state.taxType === 'federal-1040sr') {
        formTitle = 'IRS Form 1040-SR';
    } else if (state.taxType === 'indiana') {
        formTitle = 'Indiana Form IT-40';
    } else {
        // For combined, use 1040 as requested and & separator
        formTitle = 'IRS Federal 1040 & Indiana IT-40';
    }

    document.getElementById('formTypeTitle').textContent = formTitle;

    // Toggle Senior Mode for accessibility
    if (state.taxType === 'federal-1040sr') {
        document.body.classList.add('senior-mode');
    } else {
        document.body.classList.remove('senior-mode');
    }

    // Update filing status display
    const filingStatusLabel = {
        'single': 'Single',
        'married': 'Married Filing Jointly',
        'qss': 'Qualifying Surviving Spouse',
        'hoh': 'Head of Household',
        'mfs': 'Married Filing Separately'
    }[state.filingStatus];

    const filingStatusDisplay = document.getElementById('filingStatusDisplay');
    if (filingStatusDisplay) {
        if (state.filingStatus && filingStatusLabel) {
            filingStatusDisplay.textContent = `Filing Status: ${filingStatusLabel}`;
        } else {
            // For Indiana-only mode, hide filing status display
            filingStatusDisplay.textContent = '';
            filingStatusDisplay.style.display = 'none';
        }
    }

    document.getElementById('userGreeting').textContent = `Welcome, ${state.userName}!`;

    const deductionAmount = formatCurrency(state.data.deductions.standardAmount);

    // Initialize Line 12e with standard deduction
    setFieldValue('line12e', state.data.deductions.standardAmount);

    updateTotalDeductions();

    console.log('🔍 About to handle tax type:', state.taxType);

    // Handle Indiana-only tax type
    if (state.taxType === 'indiana') {
        console.log('✅ Indiana-only mode detected');

        // Hide all federal milestones
        document.querySelectorAll('.milestone-item').forEach(item => {
            if (item.dataset.section !== 'indiana' && item.dataset.section !== 'indiana-summary') {
                item.style.display = 'none';
            } else {
                item.style.display = 'block';
            }
        });


        // Make Indiana Line 1 editable for manual entry
        const indianaLine1 = document.getElementById('indianaLine1');
        if (indianaLine1) {
            indianaLine1.removeAttribute('readonly');
            indianaLine1.classList.remove('calculated');
            indianaLine1.type = 'number';
            indianaLine1.step = '0.01';
            indianaLine1.value = '0';
        }

        // Navigate directly to Indiana section
        navigateToSection('indiana');
    } else if (state.taxType === 'combined') {
        // Show all milestones
        document.querySelectorAll('.milestone-item').forEach(item => {
            item.style.display = 'block';
        });

        // Show/hide Indiana button on summary page
        const continueToIndianaBtn = document.getElementById('continueToIndianaBtn');
        if (continueToIndianaBtn) continueToIndianaBtn.style.display = 'block';

        // Initialize Indiana calculations
        updateAllIndianaCalculations();
    } else {
        // Federal only - hide Indiana milestones
        document.querySelector('.milestone-item[data-section="indiana"]').style.display = 'none';
        document.querySelector('.milestone-item[data-section="indiana-summary"]').style.display = 'none';

        // Hide Indiana button on summary page
        const continueToIndianaBtn = document.getElementById('continueToIndianaBtn');
        if (continueToIndianaBtn) continueToIndianaBtn.style.display = 'none';
    }
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function resetToHome() {
    // Hide form page, show landing page
    showPage('landingPage');

    // Reset all selection screens to initial state
    document.querySelector('.tax-type-selection').style.display = 'block';
    document.getElementById('filingStatusSelection').style.display = 'none';
    document.getElementById('countySelection').style.display = 'none';

    // Reset county selector
    document.getElementById('indianaCounty').value = '';
    document.getElementById('confirmCounty').disabled = true;

    // Reset to first section when user returns
    navigateToSection('income');
}

async function navigateToSection(sectionName) {
    // Auto-save progress before moving
    if (state.userEmail) {
        saveToServer();
    }

    state.currentSection = sectionName;

    // Update active section
    document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active');
    });

    const targetSection = document.getElementById(`${sectionName}Section`);
    if (targetSection) {
        targetSection.classList.add('active');
    } else {
        console.error(`Section #${sectionName}Section not found!`);
    }

    // Update milestone nav
    document.querySelectorAll('.milestone-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === sectionName) {
            item.classList.add('active');
        }
    });

    // Scroll to top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update calculations based on section
    if (sectionName === 'deductions') {
        // Copy AGI to Line 11b and recalculate all tax fields
        updateAllTaxAndCredits();
    }

    if (sectionName === 'credits') {
        // Recalculate all payment fields and refund/owed
        updateAllPayments();
    }

    // Update Indiana calculations if navigating to Indiana section
    if (sectionName === 'indiana') {
        updateAllIndianaCalculations();
    }

    // Update summary if navigating there
    if (sectionName === 'summary') {
        updateSummary();
    }

    // Update final Indiana summary if navigating there
    if (sectionName === 'indiana-summary') {
        updateIndianaSummary();
    }
}

function markSectionProgress(section) {
    const milestoneItem = document.querySelector(`.milestone-item[data-section="${section}"]`);
    if (milestoneItem && !milestoneItem.classList.contains('completed')) {
        milestoneItem.classList.add('completed');
    }
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const resultsContainer = document.getElementById('searchResults');

    if (query.length < 2) {
        resultsContainer.classList.remove('active');
        return;
    }

    const results = knowledgeBase.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query)
    );

    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="search-result-item"><div class="search-result-content">No results found. Try searching for specific line numbers or tax terms.</div></div>';
    } else {
        resultsContainer.innerHTML = results.map(result => `
            <div class="search-result-item">
                <div class="search-result-title">${result.title}</div>
                <div class="search-result-content">${result.content}</div>
            </div>
        `).join('');
    }

    resultsContainer.classList.add('active');
}

// New Form 1040-SR Calculation Functions

function getFieldValue(fieldId) {
    const element = document.getElementById(fieldId);
    if (!element) return 0;

    // Get the value and handle empty/null cases
    let value = element.value;
    if (!value || value.trim() === '') return 0;

    // Remove commas and any other non-numeric characters except decimal point and minus sign
    value = value.replace(/[^0-9.-]/g, '');

    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
}

function setFieldValue(fieldId, value) {
    const element = document.getElementById(fieldId);
    if (element) {
        // Only format readonly/calculated fields
        if (element.readOnly || element.classList.contains('calculated')) {
            // Check if it's a text input or number input
            // Number inputs can't accept comma-formatted values
            if (element.type === 'text') {
                const formatted = value.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
                element.value = formatted;
            } else {
                // For number inputs, use plain decimal format
                element.value = value.toFixed(2);
            }
        }
        // Don't set value for regular input fields - they manage their own values
    }
}

// Calculate Standard Deduction based on Line 12d checkboxes
function updateStandardDeduction() {
    if (!state.filingStatus) {
        console.warn('⚠️ Filing status is not set! Cannot calculate standard deduction.');
        console.log('Current state:', state);
        return 0;
    }

    // Count the number of boxes checked on line 12d
    let boxesChecked = 0;

    // Taxpayer checkboxes (all filing statuses)
    if (document.getElementById('line12d1')?.checked) boxesChecked++; // Born before Jan 2, 1961
    if (document.getElementById('line12d2')?.checked) boxesChecked++; // Are blind

    // Spouse checkboxes (for married filing jointly, qualifying surviving spouse, and married filing separately)
    if (state.filingStatus === 'married' || state.filingStatus === 'qss' || state.filingStatus === 'mfs') {
        if (document.getElementById('line12dSpouse1')?.checked) boxesChecked++; // Spouse born before Jan 2, 1961
        if (document.getElementById('line12dSpouse2')?.checked) boxesChecked++; // Spouse is blind
    }

    // Get the standard deduction from the chart
    const standardDeduction = STANDARD_DEDUCTION_CHART[state.filingStatus][boxesChecked];

    console.log(`📊 Standard Deduction Calculation:
    Filing Status: ${state.filingStatus}
    Boxes Checked: ${boxesChecked}
    Deduction Amount: $${standardDeduction.toLocaleString()}`);

    // Update line 12e and state
    setFieldValue('line12e', standardDeduction);
    state.data.deductions.standardAmount = standardDeduction;

    return standardDeduction;
}

// Line 1z: Total Wages (sum of 1a through 1h)
function updateLine1zTotal() {
    const line1a = getFieldValue('line1a');
    const line1b = getFieldValue('line1b');
    const line1c = getFieldValue('line1c');
    const line1d = getFieldValue('line1d');
    const line1e = getFieldValue('line1e');
    const line1f = getFieldValue('line1f');
    const line1g = getFieldValue('line1g');
    const line1h = getFieldValue('line1h');

    const total = line1a + line1b + line1c + line1d + line1e + line1f + line1g + line1h;

    console.log(`💰 Line 1z Calculation:
    1a: ${line1a}
    1b: ${line1b}
    1c: ${line1c}
    1d: ${line1d}
    1e: ${line1e}
    1f: ${line1f}
    1g: ${line1g}
    1h: ${line1h}
    Total: ${total}`);

    setFieldValue('line1z', total);
    return total;
}

// Line 9: Total Income (sum of 1z, 2b, 3b, 4b, 5b, 6b, 7, 8)
function updateLine9Total() {
    const line1z = getFieldValue('line1z');
    const line2b = getFieldValue('line2b');
    const line3b = getFieldValue('line3b');
    const line4b = getFieldValue('line4b');
    const line5b = getFieldValue('line5b');
    const line6b = getFieldValue('line6b');
    const line7 = getFieldValue('line7');
    const line8 = getFieldValue('line8');

    const total = line1z + line2b + line3b + line4b + line5b + line6b + line7 + line8;
    setFieldValue('line9', total);
    return total;
}

// Line 11a: Adjusted Gross Income (Line 9 minus Line 10)
function updateLine11aAGI() {
    const line9 = getFieldValue('line9');
    const line10 = getFieldValue('line10');

    const agi = Math.max(0, line9 - line10);
    setFieldValue('line11a', agi);

    // Sync to Indiana Line 1 in real-time for combined mode
    if (state.taxType === 'combined') {
        updateIndianaLine1();
        updateAllIndianaCalculations();
    }

    return agi;
}

// Legacy function for backward compatibility (if needed elsewhere)
function updateTotalIncome() {
    updateLine1zTotal();
    updateLine9Total();
    updateLine11aAGI();
}

// Tax and Credits Section Calculation Functions

// Line 11b: Copy AGI from Line 11a
function updateLine11b() {
    const line11a = getFieldValue('line11a');
    setFieldValue('line11b', line11a);
    return line11a;
}

// Line 12e: Standard Deduction (based on filing status and age)
function updateLine12eStandardDeduction() {
    // This is set from state.data.deductions.standardAmount
    const standardDeduction = state.data.deductions.standardAmount || 0;
    setFieldValue('line12e', standardDeduction);
    return standardDeduction;
}

// Line 14: Total Deductions (12e + 13a + 13b)
function updateLine14TotalDeductions() {
    const line12e = getFieldValue('line12e');
    const line13a = getFieldValue('line13a');
    const line13b = getFieldValue('line13b');

    const total = line12e + line13a + line13b;
    setFieldValue('line14', total);
    return total;
}

// Line 15: Taxable Income (11b - 14)
function updateLine15TaxableIncome() {
    const line11b = getFieldValue('line11b');
    const line14 = getFieldValue('line14');

    const taxableIncome = Math.max(0, line11b - line14);
    setFieldValue('line15', taxableIncome);
    return taxableIncome;
}

// Line 16: Tax (calculated using IRS Tax Computation Worksheet)
function updateLine16Tax() {
    const taxableIncome = getFieldValue('line15');

    console.log(`🔍 updateLine16Tax called:
    Taxable Income: $${taxableIncome.toLocaleString()}
    Filing Status: ${state.filingStatus}`);

    if (!state.filingStatus) {
        console.error('⚠️ Filing status not set! Cannot calculate tax.');
        setFieldValue('line16', 0);
        return 0;
    }

    const tax = calculateFederalTax(taxableIncome, state.filingStatus);
    setFieldValue('line16', tax);
    return tax;
}

// Line 18: Add lines 16 and 17
function updateLine18() {
    const line16 = getFieldValue('line16');
    const line17 = getFieldValue('line17');

    const total = line16 + line17;
    setFieldValue('line18', total);
    return total;
}

// Line 21: Add lines 19 and 20
function updateLine21() {
    const line19 = getFieldValue('line19');
    const line20 = getFieldValue('line20');

    const total = line19 + line20;
    setFieldValue('line21', total);
    return total;
}

// Line 22: Subtract line 21 from line 18
function updateLine22() {
    const line18 = getFieldValue('line18');
    const line21 = getFieldValue('line21');

    const result = Math.max(0, line18 - line21);
    setFieldValue('line22', result);
    return result;
}

// Line 24: Total Tax (22 + 23)
function updateLine24TotalTax() {
    const line22 = getFieldValue('line22');
    const line23 = getFieldValue('line23');

    const totalTax = line22 + line23;
    setFieldValue('line24', totalTax);
    return totalTax;
}

// ===== Indiana IT-40 Calculation Functions =====

// Indiana Line 1: Federal AGI (auto-filled from Line 11a)
function updateIndianaLine1() {
    const federalAGI = getFieldValue('line11a');
    setFieldValue('indianaLine1', federalAGI);
    return federalAGI;
}

// Indiana Line 3: Add lines 1 and 2
function updateIndianaLine3() {
    const line1 = getFieldValue('indianaLine1');
    const line2 = getFieldValue('indianaLine2');
    const total = line1 + line2;
    setFieldValue('indianaLine3', total);
    return total;
}

// Indiana Line 5: Subtract line 4 from line 3
function updateIndianaLine5() {
    const line3 = getFieldValue('indianaLine3');
    const line4 = getFieldValue('indianaLine4');
    const result = Math.max(0, line3 - line4);
    setFieldValue('indianaLine5', result);
    return result;
}

// Indiana Line 7: Indiana AGI (subtract line 6 from line 5)
function updateIndianaLine7() {
    const line5 = getFieldValue('indianaLine5');
    const line6 = getFieldValue('indianaLine6');
    const indianaAGI = Math.max(0, line5 - line6);
    setFieldValue('indianaLine7', indianaAGI);
    return indianaAGI;
}

// Indiana Line 8: State Tax (3.00%)
function updateIndianaLine8() {
    const indianaAGI = getFieldValue('indianaLine7');
    const stateTax = indianaAGI * 0.03; // 3.00% for 2025
    console.log(`🏦 Indiana Line 8 (State Tax): ${indianaAGI} * 0.03 = ${stateTax}`);
    setFieldValue('indianaLine8', stateTax);
    return stateTax;
}

// Indiana Line 9: County Tax
function updateIndianaLine9() {
    const indianaAGI = getFieldValue('indianaLine7');
    const countyRate = (state.indiana.countyRate || 0) / 100;
    const countyTax = indianaAGI * countyRate;
    console.log(`🏦 Indiana Line 9 (County Tax): ${indianaAGI} * ${countyRate} = ${countyTax}`);
    setFieldValue('indianaLine9', countyTax);
    return countyTax;
}

// Indiana Line 11: Total Indiana Taxes
function updateIndianaLine11() {
    const line8 = getFieldValue('indianaLine8');
    const line9 = getFieldValue('indianaLine9');
    const line10 = getFieldValue('indianaLine10');
    const totalTax = line8 + line9 + line10;
    console.log(`🏦 Indiana Line 11 (Total Tax): ${line8} + ${line9} + ${line10} = ${totalTax}`);
    setFieldValue('indianaLine11', totalTax);
    return totalTax;
}

// Indiana Line 14: Total Credits
function updateIndianaLine14() {
    const line12 = getFieldValue('indianaLine12');
    const line13 = getFieldValue('indianaLine13');
    const totalCredits = line12 + line13;
    setFieldValue('indianaLine14', totalCredits);
    return totalCredits;
}

// Indiana Line 15: Copy from Line 11
function updateIndianaLine15() {
    const line11 = getFieldValue('indianaLine11');
    setFieldValue('indianaLine15', line11);
    return line11;
}

// Indiana Line 16: Overpayment or Amount Owed
function updateIndianaLine16() {
    const line14 = getFieldValue('indianaLine14');
    const line15 = getFieldValue('indianaLine15');
    const difference = line14 - line15;
    setFieldValue('indianaLine16', difference);

    // Show/hide refund or owed sections based on result
    const refundSection = document.getElementById('indianaRefundSection');
    const owedSection = document.getElementById('indianaOwedSection');

    if (difference > 0) {
        // Overpayment - show refund section
        if (refundSection) refundSection.style.display = 'block';
        if (owedSection) owedSection.style.display = 'none';
    } else if (difference < 0) {
        // Amount owed - show owed section
        if (refundSection) refundSection.style.display = 'none';
        if (owedSection) owedSection.style.display = 'block';
    } else {
        // Exactly zero - hide both
        if (refundSection) refundSection.style.display = 'none';
        if (owedSection) owedSection.style.display = 'none';
    }

    return difference;
}

// Indiana Line 18: Overpayment After Donations
function updateIndianaLine18() {
    const line16 = getFieldValue('indianaLine16');
    const line17 = getFieldValue('indianaLine17');
    const afterDonations = Math.max(0, line16 - line17);
    setFieldValue('indianaLine18', afterDonations);
    return afterDonations;
}

// Indiana Line 21: Refund Amount
function updateIndianaLine21() {
    const line18 = getFieldValue('indianaLine18');
    const line19 = getFieldValue('indianaLine19');
    const line20 = getFieldValue('indianaLine20');
    const refund = Math.max(0, line18 - line19 - line20);
    setFieldValue('indianaLine21', refund);
    return refund;
}

// Indiana Line 23: Amount Owed (before penalties)
function updateIndianaLine23() {
    const line15 = getFieldValue('indianaLine15');
    const line14 = getFieldValue('indianaLine14');
    const owed = Math.max(0, line15 - line14);
    setFieldValue('indianaLine23', owed);
    return owed;
}

// Indiana Line 26: Total Amount Owed
function updateIndianaLine26() {
    const line23 = getFieldValue('indianaLine23');
    const line24 = getFieldValue('indianaLine24');
    const line25 = getFieldValue('indianaLine25');
    const totalOwed = line23 + line24 + line25;
    setFieldValue('indianaLine26', totalOwed);
    return totalOwed;
}

// Update all Indiana calculations
function updateAllIndianaCalculations() {
    updateIndianaLine1();
    updateIndianaLine3();
    updateIndianaLine5();
    updateIndianaLine7();
    updateIndianaLine8();
    updateIndianaLine9();
    updateIndianaLine11();
    updateIndianaLine14();
    updateIndianaLine15();
    updateIndianaLine16();
    updateIndianaLine18();
    updateIndianaLine21();
    updateIndianaLine23();
    updateIndianaLine26();
}


// Update all Tax and Credits calculations
function updateAllTaxAndCredits() {
    updateLine11b();
    updateLine12eStandardDeduction();
    updateLine14TotalDeductions();
    updateLine15TaxableIncome();
    updateLine16Tax();
    updateLine18();
    updateLine21();
    updateLine22();
    updateLine24TotalTax();
}

// Payments Section Calculation Functions

// Line 25d: Total Federal Withholding (25a + 25b + 25c)
function updateLine25dWithholding() {
    const line25a = getFieldValue('line25a');
    const line25b = getFieldValue('line25b');
    const line25c = getFieldValue('line25c');

    const total = line25a + line25b + line25c;
    setFieldValue('line25d', total);
    return total;
}

// Line 32: Total Other Payments (26 + 27 + 28 + 29 + 30 + 31)
function updateLine32OtherPayments() {
    const line26 = getFieldValue('line26');
    const line27 = getFieldValue('line27');
    const line28 = getFieldValue('line28');
    const line29 = getFieldValue('line29');
    const line30 = getFieldValue('line30');
    const line31 = getFieldValue('line31');

    const total = line26 + line27 + line28 + line29 + line30 + line31;
    setFieldValue('line32', total);
    return total;
}

// Line 33: Total Payments (25d + 32)
function updateLine33TotalPayments() {
    const line25d = getFieldValue('line25d');
    const line32 = getFieldValue('line32');

    const total = line25d + line32;
    setFieldValue('line33', total);
    return total;
}

// Lines 34 & 37: Refund or Amount Owed (conditional display)
function updateRefundOrOwed() {
    const totalTax = getFieldValue('line24');
    const totalPayments = getFieldValue('line33');

    const refundSection = document.getElementById('refundSection');
    const owedSection = document.getElementById('owedSection');

    if (totalPayments > totalTax) {
        // Overpayment - show refund section
        const refund = totalPayments - totalTax;
        setFieldValue('line34', refund);
        setFieldValue('line35a', refund); // Default refund amount to full overpayment
        refundSection.classList.add('active');
        owedSection.classList.remove('active');
        setFieldValue('line37', 0);
    } else if (totalTax > totalPayments) {
        // Underpayment - show amount owed section
        const owed = totalTax - totalPayments;
        setFieldValue('line37', owed);
        owedSection.classList.add('active');
        refundSection.classList.remove('active');
        setFieldValue('line34', 0);
        setFieldValue('line35a', 0);
    } else {
        // Exactly even - hide both sections
        refundSection.classList.remove('active');
        owedSection.classList.remove('active');
        setFieldValue('line34', 0);
        setFieldValue('line37', 0);
        setFieldValue('line35a', 0);
    }
}

// Update all payment calculations
function updateAllPayments() {
    updateLine25dWithholding();
    updateLine32OtherPayments();
    updateLine33TotalPayments();
    updateRefundOrOwed();
}

function updateTotalDeductions() {
    let total;
    if (state.data.deductions.type === 'standard') {
        total = state.data.deductions.standardAmount;
    } else {
        total = Object.values(state.data.deductions.itemized).reduce((sum, val) => sum + val, 0);
    }
    const totalDeductionsEl = document.getElementById('totalDeductions');
    if (totalDeductionsEl) {
        totalDeductionsEl.textContent = formatCurrency(total);
    }
}

function updateTotalCredits() {
    const childCredit = state.data.credits.childTaxCredit * 2200; // Updated to $2,200 for 2025
    const total = childCredit +
        state.data.credits.earnedIncomeCredit +
        state.data.credits.educationCredit +
        state.data.credits.federalWithholding;
    document.getElementById('totalCredits').textContent = formatCurrency(total);
}

function updateSummary() {
    // Pull ALL values from DOM for summary to ensure accuracy with user entries
    const totalIncome = getFieldValue('line9');
    const totalDeductions = getFieldValue('line14');
    const taxableIncome = getFieldValue('line15');
    const federalTax = getFieldValue('line24');
    const totalCredits = getFieldValue('line33');

    // In this "Federal Summary" view, we prioritize the Federal results
    const finalAmount = totalCredits - federalTax;

    console.log(`📊 Federal Summary Update:
    Total Income: ${totalIncome}
    Total Deductions: ${totalDeductions}
    Taxable Income: ${taxableIncome}
    Federal Tax: ${federalTax}
    Total Credits: ${totalCredits}
    Final Amount: ${finalAmount}`);

    // Update summary display
    document.getElementById('summaryIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('summaryDeductions').textContent = '-' + formatCurrency(totalDeductions);
    document.getElementById('taxableIncome').textContent = formatCurrency(taxableIncome);
    document.getElementById('estimatedTax').textContent = formatCurrency(federalTax); // NOTE: Federal only here
    document.getElementById('summaryCredits').textContent = '-' + formatCurrency(totalCredits);

    const finalAmountEl = document.getElementById('finalAmount');
    const finalLabelEl = document.getElementById('finalLabel');

    if (finalAmount > 0) {
        finalAmountEl.textContent = formatCurrency(finalAmount);
        finalAmountEl.className = 'refund';
        finalLabelEl.innerHTML = '<strong>Federal Refund</strong>';
    } else {
        finalAmountEl.textContent = formatCurrency(Math.abs(finalAmount));
        finalAmountEl.className = 'owed';
        finalLabelEl.innerHTML = '<strong>Federal Tax Owed</strong>';
    }

    // Generate plain English summary (Federal focus)
    generatePlainEnglishSummary(totalIncome, totalDeductions, taxableIncome, federalTax, 0, totalCredits, finalAmount);

    markSectionProgress('summary');
}

// New function for final State Tax Calculations view
function updateIndianaSummary() {
    const federalAGI = getFieldValue('line11a');
    const federalTax = getFieldValue('line24');
    const indianaTax = getFieldValue('indianaLine11');
    const totalTaxLiability = federalTax + indianaTax;
    const totalCredits = getFieldValue('line33') + getFieldValue('indianaLine14');
    const finalAmount = totalCredits - totalTaxLiability;

    console.log(`📊 State Summary Update:
    Federal AGI: ${federalAGI}
    Federal Tax: ${federalTax}
    Indiana Tax: ${indianaTax}
    Total Liability: ${totalTaxLiability}
    Total Combined Credits: ${totalCredits}
    Final Overall Amount: ${finalAmount}`);

    // Update final summary display
    document.getElementById('finalFederalAGI').textContent = formatCurrency(federalAGI);
    document.getElementById('finalFederalTax').textContent = formatCurrency(federalTax);
    document.getElementById('finalIndianaTax').textContent = formatCurrency(indianaTax);
    document.getElementById('finalTotalTax').textContent = formatCurrency(totalTaxLiability);
    document.getElementById('finalTotalCredits').textContent = formatCurrency(totalCredits);

    const finalAmountEl = document.getElementById('finalOverallAmount');
    const finalLabelEl = document.getElementById('finalOverallLabel');

    if (finalAmount > 0) {
        finalAmountEl.textContent = formatCurrency(finalAmount);
        finalAmountEl.className = 'refund';
        finalLabelEl.innerHTML = '<strong>Total Combined Refund</strong>';
    } else {
        finalAmountEl.textContent = formatCurrency(Math.abs(finalAmount));
        finalAmountEl.className = 'owed';
        finalLabelEl.innerHTML = '<strong>Total Combined Amount Owed</strong>';
    }

    // Special message for final summary
    const summaryEl = document.getElementById('finalPlainEnglishSummary');
    let summary = `<p>Your total tax picture is complete! You have a federal liability of <strong>${formatCurrency(federalTax)}</strong> and an Indiana liability of <strong>${formatCurrency(indianaTax)}</strong>.</p>`;

    if (finalAmount > 0) {
        summary += `<p class="refund-msg">Taking into account all your federal and state credits and withholding, you are due a total refund of <strong>${formatCurrency(finalAmount)}</strong>! 🎉</p>`;
    } else {
        summary += `<p class="owed-msg">Taking into account all your federal and state credits and withholding, your total balance due is <strong>${formatCurrency(Math.abs(finalAmount))}</strong>.</p>`;
    }
    summaryEl.innerHTML = summary;

    markSectionProgress('indiana-summary');
}

function generatePlainEnglishSummary(income, deductions, taxable, federalTax, indianaTax, credits, final) {
    const summaryEl = document.getElementById('plainEnglishSummary');

    let summary = `Based on your entries, here's your tax summary:\n\n`;

    summary += `You reported <strong>${formatCurrency(income)}</strong> in total income. `;

    if (document.getElementById('itemizedDeductionsSection').style.display !== 'none') {
        summary += `You're itemizing deductions totaling <strong>${formatCurrency(deductions)}</strong>. `;
    } else {
        const filingStatusLabel = {
            'single': 'Single',
            'married': 'Married Filing Jointly',
            'hoh': 'Head of Household',
            'qss': 'Qualifying Surviving Spouse',
            'mfs': 'Married Filing Separately'
        }[state.filingStatus] || 'your status';
        summary += `You're taking the standard deduction total of <strong>${formatCurrency(deductions)}</strong> (${filingStatusLabel}). `;
    }

    summary += `This brings your taxable income to <strong>${formatCurrency(taxable)}</strong>.\n\n`;

    if (state.taxType === 'federal' || state.taxType === 'combined') {
        summary += `Your estimated federal tax is <strong>${formatCurrency(federalTax)}</strong>. `;
    }

    if (state.taxType === 'indiana' || state.taxType === 'combined') {
        summary += `Your Indiana state tax (3.00% + ${state.indiana.countyRate}% county) is <strong>${formatCurrency(indianaTax)}</strong>. `;
    }

    if (state.data.credits.childTaxCredit > 0) {
        summary += `You claimed the Child Tax Credit for ${state.data.credits.childTaxCredit} child${state.data.credits.childTaxCredit > 1 ? 'ren' : ''}. `;
    }

    summary += `\n\nWith all credits and withholding totaling <strong>${formatCurrency(credits)}</strong>, `;

    if (final > 0) {
        summary += `you should receive a <strong class="refund">refund of ${formatCurrency(final)}</strong>! 🎉`;
    } else {
        summary += `you owe <strong class="owed">${formatCurrency(Math.abs(final))}</strong>.`;
    }

    summaryEl.innerHTML = summary.replace(/\n\n/g, '<br><br>');
}


function calculateIndianaTax(taxableIncome) {
    // Indiana flat tax rate: 3.00% + county rate for 2025
    const stateRate = 0.03;
    const countyRate = state.indiana.countyRate / 100;
    const totalRate = stateRate + countyRate;

    return Math.round(taxableIncome * totalRate);
}

function runPreCheck() {
    const warnings = [];
    const warningsEl = document.getElementById('validationWarnings');

    // Pull real values from DOM
    const totalIncome = getFieldValue('line9');
    const wages = getFieldValue('line1z');
    const withholding = getFieldValue('line25d');
    const itemizedTotal = getFieldValue('line14');
    const standardDeduction = getFieldValue('line12e');

    if (totalIncome === 0) {
        warnings.push('No income reported. Make sure to enter all sources of income.');
    }

    if (wages === 0 && totalIncome > 0) {
        warnings.push('You have income but no wages. This is fine if you\'re retired or self-employed.');
    }

    if (withholding === 0 && (state.taxType === 'federal' || state.taxType === 'combined')) {
        warnings.push('No federal withholding entered. If you had taxes withheld from paychecks, make sure to enter this amount.');
    }

    const isItemizing = document.getElementById('itemizedDeductionsSection').style.display !== 'none';
    if (isItemizing && itemizedTotal < standardDeduction) {
        warnings.push(`Your itemized deductions (${formatCurrency(itemizedTotal)}) are less than the standard deduction (${formatCurrency(standardDeduction)}). Consider using the standard deduction instead.`);
    }

    if (warnings.length === 0) {
        warningsEl.innerHTML = '<div style="background: #d1fae5; border-left-color: #10b981; color: #065f46;"><strong>✓ All checks passed!</strong> Your form looks good.</div>';
        warningsEl.classList.add('active');
    } else {
        warningsEl.innerHTML = warnings.map(w => `<div class="warning-item">${w}</div>`).join('');
        warningsEl.classList.add('active');
    }

    setTimeout(() => {
        warningsEl.classList.remove('active');
    }, 8000);
}

function generatePDF() {
    if (!state.userEmail) {
        alert('Please log in to download your PDF.');
        showLoginModal();
        return;
    }

    // Prepare print labels
    const filingStatusLabel = {
        'single': 'Single',
        'married': 'Married Filing Jointly',
        'hoh': 'Head of Household',
        'qss': 'Qualifying Surviving Spouse',
        'mfs': 'Married Filing Separately'
    }[state.filingStatus] || 'Not Set';

    // Populate Print Summary Fields
    document.getElementById('printUserName').textContent = state.userName;
    document.getElementById('printUserEmail').textContent = state.userEmail;
    document.getElementById('printFilingStatus').textContent = filingStatusLabel;

    let formSubtitle = '';
    if (state.taxType === 'federal-1040') formSubtitle = 'IRS Form 1040';
    else if (state.taxType === 'federal-1040sr') formSubtitle = 'IRS Form 1040-SR';
    else if (state.taxType === 'indiana') formSubtitle = 'Indiana Form IT-40';
    else formSubtitle = 'IRS Form 1040 & Indiana IT-40';
    document.getElementById('printFormSubtitle').textContent = formSubtitle;

    if (state.indiana.county) {
        document.getElementById('printCountyInfo').innerHTML = `<strong>Indiana County:</strong> ${state.indiana.county} (${state.indiana.countyRate}%)`;
    }

    // Populate Numbers
    const line9 = getFieldValue('line9');
    const line11a = getFieldValue('line11a');
    const line14 = getFieldValue('line14');
    const line15 = getFieldValue('line15');
    const line24 = getFieldValue('line24');
    const indianaTax = (state.taxType === 'indiana' || state.taxType === 'combined') ? getFieldValue('indianaLine11') : 0;
    const totalPayments = getFieldValue('line33');
    const totalLiability = line24 + indianaTax;
    const finalResult = totalPayments - totalLiability;

    document.getElementById('printTotalIncome').textContent = formatCurrency(line9);
    document.getElementById('printAGI').textContent = formatCurrency(line11a);
    document.getElementById('printTotalDeductions').textContent = formatCurrency(line14);
    document.getElementById('printTaxableIncome').textContent = formatCurrency(line15);
    document.getElementById('printFederalTax').textContent = formatCurrency(line24);

    const indianaSection = document.getElementById('printIndianaSection');
    if (state.taxType === 'indiana' || state.taxType === 'combined') {
        indianaSection.style.display = 'block';
        document.getElementById('printIndianaTax').textContent = formatCurrency(indianaTax);
    } else {
        indianaSection.style.display = 'none';
    }

    document.getElementById('printTotalLiability').textContent = formatCurrency(totalLiability);
    document.getElementById('printTotalPayments').textContent = formatCurrency(totalPayments);

    const resultTypeNode = document.getElementById('printResultType');
    const resultAmountNode = document.getElementById('printResultAmount');
    if (finalResult >= 0) {
        resultTypeNode.textContent = 'REFUND AMOUNT:';
        resultAmountNode.textContent = formatCurrency(finalResult);
        resultAmountNode.style.color = '#10b981';
    } else {
        resultTypeNode.textContent = 'AMOUNT YOU OWE:';
        resultAmountNode.textContent = formatCurrency(Math.abs(finalResult));
        resultAmountNode.style.color = '#ef4444';
    }

    document.getElementById('printDate').textContent = new Date().toLocaleString();

    // Trigger Print
    window.print();
}

// Enhancement Helper Functions
function updateDynamicPrompt6b(socialSecurityValue) {
    const promptSpan = document.getElementById('promptText6b');
    if (promptSpan) {
        const amount = socialSecurityValue || '0.00';
        const formattedAmount = parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
        promptSpan.textContent = `Give me Schedule B Part 1, 2 Totals and tell me what lines in the 1040 to input them. Then give me the Schedule D Part 3 Total and tell me what lines in the 1040 to input them. No other information, just the Totals of each part, and what line in the 1040 to input them? Also, my combined Social Security is ${formattedAmount}, calculate what my taxable income is for 1040 line 6b. Put them in a Table format. Put the sources in another column.`;
    }
}

function updateLiveSummary() {
    const totalTax = getFieldValue('line24') + ((state.taxType === 'indiana' || state.taxType === 'combined') ? getFieldValue('indianaLine11') : 0);
    const totalPayments = getFieldValue('line33');
    const diff = totalPayments - totalTax;

    document.getElementById('sideTotalTax').textContent = formatCurrency(totalTax);
    document.getElementById('sideTotalPayments').textContent = formatCurrency(totalPayments);

    const statusText = document.getElementById('sideStatusText');
    const statusAmount = document.getElementById('sideStatusAmount');

    if (diff >= 0) {
        statusText.textContent = 'Refund:';
        statusAmount.textContent = formatCurrency(diff);
        statusAmount.className = 'refund';
    } else {
        statusText.textContent = 'Amount Owed:';
        statusAmount.textContent = formatCurrency(Math.abs(diff));
        statusAmount.className = 'owed';
    }

    // Also update optimizer while we're at it
    updateDeductionOptimizer();
}

function updateDeductionOptimizer() {
    const agi = getFieldValue('line11a');
    if (agi === 0) return;

    const standardAmount = state.data.deductions.standardAmount || 0;
    // Assuming user might be entering itemized values if they are active
    const itemizedTotal = (parseFloat(document.getElementById('itemizedMedical')?.value) || 0) +
        (parseFloat(document.getElementById('itemizedStateTaxes')?.value) || 0) +
        (parseFloat(document.getElementById('itemizedMortgage')?.value) || 0) +
        (parseFloat(document.getElementById('itemizedCharitable')?.value) || 0);

    const tipDiv = document.getElementById('deductionOptimizerTip');
    const tipText = document.getElementById('optimizerText');

    if (itemizedTotal > standardAmount) {
        tipDiv.style.display = 'flex';
        tipText.textContent = `Your Itemized Deductions (${formatCurrency(itemizedTotal)}) are currently greater than your Standard Deduction (${formatCurrency(standardAmount)}). You should consider itemizing!`;
        tipDiv.style.background = 'rgba(16, 185, 129, 0.1)';
    } else if (itemizedTotal > 0 && itemizedTotal <= standardAmount) {
        tipDiv.style.display = 'flex';
        tipText.textContent = `Your Standard Deduction (${formatCurrency(standardAmount)}) is still better than itemizing (${formatCurrency(itemizedTotal)}). We'll keep using the Standard amount.`;
        tipDiv.style.background = 'rgba(37, 99, 235, 0.1)';
    } else {
        tipDiv.style.display = 'none';
    }
}

function saveProgress() {
    localStorage.setItem('taxCalculatorState', JSON.stringify(state));
    saveToServer(true); // pass true to show alert
}

async function saveToServer(showNotification = false) {
    if (!state.userEmail) return;

    try {
        // Collect all form data directly from the DOM to ensure we capture everything
        const formData = {};
        document.querySelectorAll('input.input-field, select.county-select, input.checkbox-field, input[type="checkbox"]').forEach(el => {
            if (el.id) {
                formData[el.id] = el.type === 'checkbox' ? el.checked : el.value;
            }
        });

        // Add core state info
        formData.taxType = state.taxType;
        formData.filingStatus = state.filingStatus;
        formData.formType = state.formType;
        formData.userName = state.userName;

        const response = await fetch('/api/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: state.userEmail,
                data: formData
            })
        });

        if (response.ok && showNotification) {
            console.log('✅ Progress saved to server');
        }
    } catch (error) {
        console.error('Error saving data to server:', error);
    }
}

function loadSavedProgress() {
    // This is called on DOMDidLoad
    const saved = localStorage.getItem('taxCalculatorState');
    if (saved) {
        console.log('Local progress found');
        // We'll let the email login handle the server-side loading
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(amount);
}

// ===== EMILY VOICE AI ASSISTANT =====

// Emily's comprehensive tax knowledge base
const emilyKnowledge = {
    // Form 1040 Lines
    "wages": "Wages, salaries, and tips go on Line 1 of Form 1040. This includes all income from your W-2 forms - your salary, hourly wages, bonuses, commissions, and any tips you reported. Add up all your W-2s if you had multiple jobs.",

    "interest income": "Interest income goes on Line 2b. This includes interest from savings accounts, checking accounts, CDs, bonds, and money market accounts. Your bank will send you Form 1099-INT if you earned more than $10 in interest.",

    "dividends": "Dividends go on Line 3b. These are payments from stocks, mutual funds, or ETFs you own. Your brokerage will send Form 1099-DIV. Only qualified dividends go here - ordinary dividends go on a different line.",

    "retirement income": "Retirement income goes on Line 4b. For 2025, contribution limits increased to $23,500 for 401(k)s ($31,000 if 50+) and remain at $7,000 for IRAs ($8,000 if 50+). HSA limits are also up to $4,300 (Single) / $8,550 (Family).",

    "2025 changes": "Major changes for 2025 include: 1) Increased Standard Deductions ($15,750 Single / $31,500 Married), 2) A massive $6,000 senior boost, 3) 'No Tax on Tips' up to $25k, 4) 'No Tax on Overtime' deductions, 5) Child Tax Credit increase to $2,200, and 6) $1,000 'Trump Accounts' for newborns.",

    "new for 2025": "Everything new for 2025: Standard deductions are way up, there's a huge $6,000 senior bonus, and new deductions for tips and overtime pay. We also have the $2,200 Child Tax Credit and the new $1,000 baby savings accounts!",

    "tips": "The new 2025 'No Tax on Tips' rule allows eligible workers to deduct up to $25,000 in qualified tip income from their federal taxes. This is a major new benefit to keep more of your hard-earned tips.",

    "no tax on tips": "Under the 2025 'No Tax on Tips' mandate, you can deduct up to $25,000 of your qualified tips. This is reported as an adjustment to your income.",

    "overtime": "For 2025, there is a new 'No Tax on Overtime' deduction. Workers can deduct the 'half' portion of their time-and-a-half pay, up to $12,500 ($25,000 for joint filers).",

    "no tax on overtime": "The 2025 'No Tax on Overtime' rule lets you deduct the extra premium pay you earned for overtime, effectively reducing the tax burden on your extra shifts.",

    "trump accounts": "Known as 'Trump Accounts' or 'Baby Accounts,' the government will deposit $1,000 into new savings accounts for U.S. citizens born between 2025 and 2028 to help families start saving early.",

    "baby accounts": "The 2025 'Trump Accounts' initiative provides a $1,000 initial deposit for every U.S. citizen born between 2025 and 2028. It's designed to give newborns a head start on their financial future.",

    "crypto": "Starting in 2025, cryptocurrency and digital assets have a new reporting form: Form 1099-DA. You must use this to report all digital asset transactions to the IRS.",

    "social security": "Social Security benefits go on Line 5b. Only a portion may be taxable, depending on your total income. If Social Security is your only income, it's usually not taxable. The taxable amount is calculated based on your combined income.",

    "capital gains": "Capital gains go on Line 7. This is profit from selling investments like stocks, bonds, or real estate. Short-term gains, held less than 1 year, are taxed as ordinary income. Long-term gains, held more than 1 year, get preferential tax rates.",

    // Filing Statuses
    "single": "Single filing status is for unmarried individuals. The standard deduction for 2025 is $15,750. If you're 65 or older, you get an additional $6,000, making your total standard deduction $21,750. Tax brackets are the most narrow for single filers.",

    "married filing jointly": "Married Filing Jointly is usually the best option for married couples. You combine all income and deductions. The standard deduction is $31,500 for 2025. If one spouse is 65 or older, add $6,000 (total $37,500). If both spouses are 65 or older, add $12,000 (total $43,500). Tax brackets are roughly double those for single filers.",

    "head of household": "Head of Household status is for unmarried individuals who pay more than half the cost of keeping up a home for themselves and a qualifying person. The standard deduction is $23,625 for 2025. If you're 65 or older, you get an additional $6,000, making your total standard deduction $29,625.",

    // Deductions
    "standard deduction": "The standard deduction is a fixed amount that reduces your taxable income. For 2025: Single filers get $15,750, Married Filing Jointly get $31,500, and Head of Household get $23,625. If you're 65 or older, you get extra: Single/Head of Household add $6,000, Married add $6,000 per spouse age 65+.",

    "senior deduction": "Seniors age 65 or older get a MUCH higher standard deduction in 2025! You can claim an additional $6,000 (or $12,000 for qualifying couples). For 2025: Single seniors get $21,750 (base $15,750 + $6,000 extra). Married Filing Jointly with one senior gets $37,500. Married with both seniors gets $43,500.",

    "seniors": "Seniors age 65 or older get a higher standard deduction! For 2025, individuals 65+ claim an additional $6,000. Qualifying couples can claim $12,000 extra. This helps protect more of your retirement income from taxes.",

    "65 or older": "If you're 65 or older, you get a higher standard deduction! For 2025: Single seniors get $21,750 ($15,750 base + $6,000 extra). Married Jointly with one senior gets $37,500, and both seniors gets $43,500.",

    "itemized deductions": "Itemized deductions are specific expenses you can deduct instead of taking the standard deduction. For 2025, the SALT deduction cap (state and local taxes) has increased to $40,000 for those earning under $500,000. Other items include mortgage interest and medical expenses over 7.5% of AGI.",

    "mortgage interest": "You can deduct mortgage interest if you itemize. New for 2025: You can also deduct up to $10,000 in interest on car loans for new, U.S.-assembled vehicles (see Form 1098-VLI).",

    "charitable donations": "Charitable contributions are deductible if you itemize. This includes cash and non-cash donations to qualified charitable organizations. Keep receipts for all donations. For donations over $250, you need written acknowledgment from the charity.",

    "medical expenses": "Medical and dental expenses are deductible if you itemize, but only the amount that exceeds 7.5% of your adjusted gross income. This includes doctor visits, prescriptions, insurance premiums, and medical equipment.",

    // Tax Credits
    "child tax credit": "The Child Tax Credit for 2025 has increased to $2,200 per qualifying child under age 17. The child must be your dependent and have a Social Security number. The credit phases out at higher income levels.",

    "earned income credit": "The Earned Income Credit, or EIC, is a refundable credit for low to moderate income workers. This sits alongside other 2025 benefits like the 'No Tax on Tips' rule (deduct up to $25k) and 'No Tax on Overtime' (deduct half portion of O.T.).",

    "education credits": "Education credits remains valuable in 2025. Note that Adoption Credits have also increased to $17,280, with up to $5,000 being refundable. Also, Clean Vehicle credits expired for vehicles acquired after Sept 30, 2025.",

    // Indiana State Tax
    "indiana tax": "Indiana has a flat income tax rate of 3.00% on adjusted gross income. Additionally, each county imposes its own income tax, ranging from about 1% to 2.5%. Your total Indiana tax is the state rate of 3.00% plus your county rate.",

    "marion county": "Marion County, which includes Indianapolis, has a county income tax rate of 2.02%. Combined with Indiana's state rate of 3.00%, your total Indiana tax rate in Marion County is 5.02%.",

    "hamilton county": "Hamilton County has a county income tax rate of 1.06%. Combined with Indiana's state rate of 3.00%, your total Indiana tax rate in Hamilton County is 4.06%.",

    "lake county": "Lake County has a county income tax rate of 1.77%. Combined with Indiana's state rate of 3.00%, your total Indiana tax rate in Lake County is 4.77%.",

    "indiana social security": "Indiana does NOT tax Social Security benefits. While you report the taxable portion on your federal return, you can take a full deduction for that same amount on your Indiana state return (Schedule 2, Adjustment Code 601), so it becomes tax-free at the state level.",

    // Tax Brackets
    "tax brackets": "Tax brackets are progressive, meaning you pay different rates on different portions of your income. For 2025, the rates are 10%, 12%, 22%, 24%, 32%, 35%, and 37%. The brackets vary by filing status. You don't pay the top rate on all your income - only on the amount in that bracket.",

    "marginal tax rate": "Your marginal tax rate is the rate you pay on your last dollar of income. This is different from your effective tax rate, which is your total tax divided by your total income. Understanding this helps with tax planning.",

    // General Tax Concepts
    "adjusted gross income": "Adjusted Gross Income, or AGI, is your total income minus certain deductions like IRA contributions, student loan interest, and health savings account contributions. AGI is used to determine eligibility for many tax benefits.",

    "taxable income": "Taxable income is your adjusted gross income minus either the standard deduction or itemized deductions. This is the amount your tax is calculated on. The lower your taxable income, the less tax you owe.",

    "withholding": "Federal withholding is the income tax your employer takes out of your paychecks throughout the year. Find this on your W-2 in Box 2. If you had multiple jobs, add up all W-2s. This is credited against your total tax owed.",

    "refund": "You get a refund if your withholding and credits exceed your tax liability. The refund is the difference. While getting a refund feels good, it means you gave the government an interest-free loan. The goal is to break even.",

    "amount owed": "You owe money if your tax liability exceeds your withholding and credits. This happens if not enough was withheld from your paychecks. You can adjust your W-4 to have more withheld to avoid owing next year.",

    // Form Types
    "form 1040": "Form 1040 is the standard U.S. Individual Income Tax Return. Everyone uses this form to file their federal taxes. It's been simplified in recent years and is now just two pages.",

    "form 1040-sr": "Form 1040 is designed for all individuals, including seniors. It's the primary federal tax return form used to report income, deductions, and credits.",

    // Deadlines
    "tax deadline": "The federal tax deadline is usually April 15th, unless it falls on a weekend or holiday. For 2025, check the IRS website for the exact date. You can file for an automatic 6-month extension, but you still need to pay any taxes owed by the original deadline.",

    // Common Questions
    "when to itemize": "You should itemize if your itemized deductions exceed the standard deduction. For 2025, that's $14,600 for single, $29,200 for married filing jointly, and $21,900 for head of household. Common itemized deductions include mortgage interest, state and local taxes, and charitable donations.",

    "difference between deduction and credit": "A deduction reduces your taxable income, while a credit reduces your tax dollar-for-dollar. Credits are more valuable. For example, a $1,000 deduction in the 22% bracket saves you $220, but a $1,000 credit saves you $1,000.",

    // Filing Basics
    "1040 vs 1040-sr": "Both are individual returns. For 2025, we use the standardized IRS 1040 for all filings to ensure consistency.",

    "do i need to file": "It depends on filing status, age, income level, and other factors like self-employment income. IRS Publication 17 covers the basics of who generally must file. Generally, if your income exceeds the standard deduction for your filing status, you need to file.",

    "filing vs paying": "Filing is submitting the return; paying is remitting any balance due. You can be required to pay even if you don't file yet, such as when on extension. Filing and paying are two separate obligations.",

    "can't file by deadline": "You can request an automatic extension, commonly by filing Form 4868. An extension gives you extra time to file (usually 6 months), but NOT extra time to pay. You still need to estimate and pay any taxes owed by the original deadline.",

    "request extension": "Use Form 4868 to request an automatic 6-month extension. You can file it electronically or by mail. Remember to estimate your tax due and pay it with the extension to avoid penalties and interest.",

    "filing status": "Your filing status (Single, Married Filing Jointly, Married Filing Separately, Head of Household, or Qualifying Surviving Spouse) affects tax rates, certain credits, and deduction rules. It's one of the most important decisions on your return.",

    "married during year": "Generally, your marital status as of December 31 controls your status for that tax year. If you got married in December, you can file as Married Filing Jointly for the entire year.",

    "e-file or paper": "E-filing typically reduces math errors and speeds processing. The IRS processes e-filed returns much faster than paper returns. E-filing also gives you confirmation that the IRS received your return.",

    "what records to keep": "Keep the return and supporting documents (W-2s, 1099s, receipts, statements) for at least 3 years in case you need to verify items later or amend. For some situations, keep records longer - IRS Publication 17 has details.",

    // Income Reporting
    "report wages": "Wages from your W-2 are reported on Line 1 of Form 1040. Add up all W-2s if you had multiple jobs. The amount in Box 1 of your W-2 is what goes on your return.",

    "report interest dividends": "Interest (1099-INT) goes on Line 2b and dividends (1099-DIV) go on Line 3b. If you have more than $1,500 in interest or dividends, you may need to file Schedule B with additional details.",

    "self-employment income": "Business income is generally reported on Schedule C, and self-employment tax is calculated on Schedule SE. The net profit from Schedule C flows to your Form 1040, and you'll owe both income tax and self-employment tax.",

    "gig work": "Gig work or side hustles are treated the same as self-employment if you're an independent contractor. Report income on Schedule C and pay self-employment tax on Schedule SE. Keep track of all income and expenses.",

    "unemployment compensation": "Unemployment compensation is taxable income reported on Line 7 of Form 1040. You should receive Form 1099-G showing the amount. You can have taxes withheld from unemployment benefits.",

    "ira distributions": "IRA distributions from Form 1099-R are reported on Line 4. Whether they're taxable depends on the type of IRA. Traditional IRA distributions are usually fully taxable, while Roth IRA qualified distributions are tax-free.",

    "social security benefits": "Social Security benefits may be taxable depending on your total income. Report them on Line 5. The 1040 instructions include a worksheet to calculate how much is taxable. Up to 85% may be taxable if your income is high enough.",

    "stock sales crypto": "Sales of stocks, bonds, and crypto are reported on Schedule D and Form 8949. You'll report each transaction showing what you paid (basis) and what you sold it for. Short-term gains (held less than 1 year) are taxed as ordinary income; long-term gains get preferential rates.",

    "rental income": "Rental income and expenses are generally reported on Schedule E. You can deduct expenses like mortgage interest, property taxes, insurance, repairs, and depreciation. Net rental income flows to your Form 1040.",

    "qcd": "A Qualified Charitable Distribution (QCD) allows individuals age 70.5 or older to donate directly from a Traditional IRA to a qualified charity. The amount is excluded from your taxable income on Line 4b, which can be more beneficial than a standard deduction. Write 'QCD' next to Line 4b.",

    "pso": "Retired Public Safety Officers (PSO) can exclude up to $3,000 from their taxable retirement income for health insurance premiums paid directly from their pension. This is reported on Line 4b or 5b of Form 1040 with the notation 'PSO' next to the taxable amount.",

    "rollover": "A rollover is when you move funds between retirement accounts (like 401k to IRA). If done within 60 days, it's tax-free. Report the total on Line 4a or 5a, but put '0' on Line 4b or 5b and write 'Rollover' next to the line.",

    "schedules 1 2 3": "Schedules 1, 2, and 3 are supplemental forms used with Form 1040 to report items that aren't on the main two pages. Schedule 1 is for additional income and adjustments, Schedule 2 is for additional taxes like self-employment tax, and Schedule 3 is for additional credits and payments.",

    "schedule 1": "Schedule 1 has two parts. Part I reports additional income like business profit, unemployment, or gambling winnings. Part II reports 'adjustments' to income—like student loan interest or IRA contributions—which reduce your Adjusted Gross Income (AGI).",

    "schedule 2": "Schedule 2 reports taxes beyond standard income tax. This includes Self-Employment tax for freelancers, the Alternative Minimum Tax (AMT), and additional taxes on retirement plan distributions.",

    "schedule 3": "Schedule 3 reports additional credits and payments. This includes non-refundable credits like the Foreign Tax Credit or Education Credits, and other payments like amounts paid with an extension request.",

    // AGI and Deductions
    "agi": "AGI (Adjusted Gross Income) is your total income after certain 'above-the-line' adjustments like IRA contributions, student loan interest, and HSA contributions. AGI drives eligibility for many deductions and credits. It's a key number on your return.",

    "adjustments to income": "Common adjustments include educator expenses, IRA contributions, student loan interest, HSA contributions, and self-employment tax deduction. These are 'above-the-line' deductions reported on Schedule 1 that reduce your AGI.",

    "standard vs itemized": "Standard deduction is a fixed amount based on filing status. Itemizing uses actual eligible expenses on Schedule A. You choose whichever is higher. Most people take the standard deduction because it's simpler and often larger.",

    "itemized deductions": "Itemized deductions are specific expenses on Schedule A: state and local taxes (capped at $10,000), mortgage interest, charitable contributions, and medical expenses above 7.5% of AGI. Only itemize if the total exceeds your standard deduction.",

    "deduct state local taxes": "If you itemize, you can deduct state and local taxes (SALT), but the deduction is capped at $10,000 total. This includes state income taxes or sales taxes, plus property taxes.",

    "deduct charitable": "Charitable contributions are deductible if you itemize and donate to qualified organizations. Keep receipts for all donations. For donations over $250, you need written acknowledgment from the charity. For non-cash donations over $500, file Form 8283.",

    "deduct medical": "Medical expenses are deductible only if you itemize and only the amount above 7.5% of your AGI. This includes doctor visits, prescriptions, insurance premiums, dental, vision, and medical equipment.",

    "employee expenses": "For most employees, unreimbursed employee expenses (including home office, mileage, supplies) generally aren't deductible under current federal rules. Self-employed individuals can deduct business expenses on Schedule C.",

    // Credits
    "credit vs deduction": "A deduction reduces taxable income; a credit reduces tax directly dollar-for-dollar. Some credits are refundable, meaning you can get money back even if you don't owe tax. Credits are more valuable than deductions.",

    "credit for other dependents": "This is a $500 credit for dependents who don't qualify for the Child Tax Credit, such as dependent parents, adult children, or other relatives. Income limits apply.",

    "eitc": "The Earned Income Tax Credit (EITC) is a refundable credit for low-to-moderate income workers. The amount depends on your earned income and number of qualifying children. Even if you don't owe taxes, you can get a refund. Check IRS tables for income limits.",

    "earned income": "For EITC purposes, earned income includes wages, salaries, tips, self-employment income, and certain disability benefits. It does NOT include interest, dividends, Social Security, unemployment, or pensions.",

    "education credits": "The American Opportunity Credit is up to $2,500 for the first 4 years of college (40% refundable). The Lifetime Learning Credit is up to $2,000 for any post-secondary education (non-refundable). You can't claim both for the same student in the same year.",

    "child dependent care credit": "If you paid for care for a child under 13 (or disabled dependent) so you could work or look for work, you may qualify. The credit is a percentage of your expenses, up to certain limits. It's non-refundable.",

    "foreign tax credit": "If you paid income taxes to a foreign country, you may be able to claim a credit to avoid double taxation. Use Form 1116 for the foreign tax credit.",

    "refundable credit": "A refundable credit can increase your refund beyond what you paid in taxes. Examples include the Earned Income Credit and the refundable portion of the Child Tax Credit. Non-refundable credits can only reduce your tax to zero.",

    // Payments and Refunds
    "federal withholding": "Federal withholding is entered in the payments section of Form 1040 on Line 25. Find this amount in Box 2 of your W-2. If you had multiple jobs, add up all W-2s. This is credited against your total tax.",

    "estimated tax payments": "If you don't have enough withholding (common for self-employed, investors, or retirees), you may need to make quarterly estimated tax payments using Form 1040-ES. Payments are due April 15, June 15, September 15, and January 15.",

    "refund smaller": "Common reasons for a smaller refund: changed withholding, income increased, credit eligibility changed, or different deductions. Compare your current return to last year's to identify what changed.",

    "owe can't pay": "If you owe but can't pay in full, still file on time to avoid the failure-to-file penalty (which is much higher than the failure-to-pay penalty). Then explore IRS payment options like installment agreements or offers in compromise.",

    // Amendments
    "made mistake": "If you made a mistake after filing, you may need to file an amended return using Form 1040-X. Wait until your original return is processed before amending. You have 3 years from the original filing date to amend.",

    "when file 1040-x": "Use Form 1040-X to correct items like income, deductions, credits, filing status, or dependents. Common reasons include missing a W-2, forgetting a deduction, or claiming the wrong filing status.",

    "documents to amend": "You need your originally filed return and the new/changed forms or statements supporting the correction. Attach any new forms (like a missing W-2 or 1099) to the 1040-X. The instructions explain what to include.",

    // IRS Resources
    "irs credits deductions": "The IRS has a 'Credits and Deductions for Individuals' page that explains all major credits and deductions. It's a great starting point for understanding what you might qualify for.",

    "find 1040 forms": "The IRS 'Forms & Instructions' page has all current and prior year forms. You can download Form 1040, all schedules, and the detailed instructions. Everything is free on IRS.gov.",

    "direct file": "The IRS Direct File program allows eligible taxpayers to file directly with the IRS for free. Availability varies by filing season and state. Check IRS.gov for current availability and eligibility requirements.",


    "estimated taxes": "If you're self-employed or have income without withholding, you may need to pay estimated taxes quarterly. This prevents owing a large amount at year-end and avoids penalties. Estimated tax payments are due April 15, June 15, September 15, and January 15.",

    "help": "I'm Emily, your voice tax assistant! I can help you with questions about Form 1040, filing statuses, deductions, credits, Indiana state taxes, and general tax concepts. Just ask me anything! You can speak by clicking the microphone or type your question."
};

// Emily Voice Assistant State
let emilyRecognition = null;
let emilySynthesis = window.speechSynthesis;
let emilyVoice = null;
let isListening = false;

// Initialize Emily
function initializeEmily() {
    // Set up speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        emilyRecognition = new SpeechRecognition();
        emilyRecognition.continuous = false;
        emilyRecognition.interimResults = false;
        emilyRecognition.lang = 'en-US';

        emilyRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            handleEmilyQuestion(transcript);
        };

        emilyRecognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            stopListening();
            if (event.error === 'no-speech') {
                addEmilyMessage("I didn't hear anything. Please try again!");
            }
        };

        emilyRecognition.onend = () => {
            stopListening();
        };
    }

    // Set up preferred voice for Emily
    if (emilySynthesis) {
        const voices = emilySynthesis.getVoices();
        // Prefer female English voice
        emilyVoice = voices.find(voice =>
            voice.lang.startsWith('en') && voice.name.includes('Female')
        ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];

        // Load voices if not loaded yet
        if (voices.length === 0) {
            emilySynthesis.onvoiceschanged = () => {
                const newVoices = emilySynthesis.getVoices();
                emilyVoice = newVoices.find(voice =>
                    voice.lang.startsWith('en') && voice.name.includes('Female')
                ) || newVoices.find(voice => voice.lang.startsWith('en')) || newVoices[0];
            };
        }
    }


    // Event listeners
    document.getElementById('emilyToggle').addEventListener('click', toggleEmilyPanel);
    document.getElementById('emilyClose').addEventListener('click', toggleEmilyPanel);
    document.getElementById('emilySend').addEventListener('click', sendEmilyMessage);
    document.getElementById('emilyInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendEmilyMessage();
    });
}

function toggleEmilyPanel() {
    const panel = document.getElementById('emilyPanel');
    panel.classList.toggle('active');
}

function toggleListening() {
    if (!emilyRecognition) {
        addEmilyMessage("Sorry, voice recognition is not supported in your browser. Please type your question instead.");
        return;
    }

    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
}

function startListening() {
    if (!emilyRecognition) {
        addEmilyMessage("Sorry, voice recognition is not supported in your browser. Please type your question instead.");
        return;
    }

    try {
        isListening = true;
        document.getElementById('emilyListening').style.display = 'flex';
        document.getElementById('emilyMic').classList.add('listening');
        emilyRecognition.start();
    } catch (error) {
        console.error('Error starting speech recognition:', error);
        stopListening();
        // Don't show error message if recognition is already started
        if (error.message && !error.message.includes('already started')) {
            addEmilyMessage("I'm having trouble with the microphone. Please try typing your question instead.");
        }
    }
}

function stopListening() {
    isListening = false;
    document.getElementById('emilyListening').style.display = 'none';
    document.getElementById('emilyMic').classList.remove('listening');
    if (emilyRecognition) {
        emilyRecognition.stop();
    }
}

function sendEmilyMessage() {
    const input = document.getElementById('emilyInput');
    const question = input.value.trim();

    if (!question) return;

    input.value = '';
    handleEmilyQuestion(question);
}

function handleEmilyQuestion(question) {
    // Add user message to chat
    addUserMessage(question);

    // Generate and add Emily's response
    const response = generateEmilyResponse(question);
    addEmilyMessage(response);
}

function generateEmilyResponse(question) {
    const lowerQuestion = question.toLowerCase();

    // Check for greetings
    if (lowerQuestion.match(/^(hi|hello|hey|good morning|good afternoon)/)) {
        return "Hello! I'm Emily, your tax assistant. How can I help you with your taxes today?";
    }

    // Check for thanks
    if (lowerQuestion.match(/(thank|thanks)/)) {
        return "You're welcome! Feel free to ask me anything else about your taxes.";
    }

    // Search knowledge base with improved matching
    let bestMatch = null;
    let bestScore = 0;

    for (const [topic, answer] of Object.entries(emilyKnowledge)) {
        // Calculate match score based on keyword overlap
        const topicWords = topic.toLowerCase().split(/\s+/);
        const questionWords = lowerQuestion.split(/\s+/);

        let score = 0;

        // Exact topic match gets highest score
        if (lowerQuestion.includes(topic.toLowerCase())) {
            score = 100;
        } else {
            // Count matching words
            for (const topicWord of topicWords) {
                if (topicWord.length > 2) { // Skip short words like "vs", "or"
                    for (const questionWord of questionWords) {
                        if (questionWord.includes(topicWord) || topicWord.includes(questionWord)) {
                            score += 10;
                            // Bonus for matching "2025" or the specific year
                            if (topicWord === '2025') score += 5;
                        }
                    }
                }
            }
        }

        // Major Priority Bonus: If the user explicitly asks for "2025" and the topic contains it
        if (lowerQuestion.includes('2025') && topic.toLowerCase().includes('2025')) {
            score += 40;
        }

        // Specific Keyword Priority: Tips, Overtime, Trump
        const priorities = ['tips', 'overtime', 'trump', 'changes', 'new'];
        for (const p of priorities) {
            if (lowerQuestion.includes(p) && topic.toLowerCase().includes(p)) {
                score += 30;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = answer;
        }
    }

    // Return best match if score is high enough
    if (bestScore >= 20) {
        return bestMatch;
    }

    // Check for specific line numbers
    const lineMatch = lowerQuestion.match(/line\s+(\d+[a-z]?)/);
    if (lineMatch) {
        return `Line ${lineMatch[1]} on Form 1040 varies depending on what you're asking about. Could you be more specific? For example, ask about wages, interest income, deductions, or credits.`;
    }

    // Check for calculator-specific questions
    if (lowerQuestion.includes('how') && lowerQuestion.includes('use')) {
        return "To use this calculator, first select your tax type and filing status on the landing page. Then enter your income, choose your deductions, add any credits, and view your summary. You can save your progress at any time!";
    }

    if (lowerQuestion.includes('save') || lowerQuestion.includes('progress')) {
        return "Your progress is automatically saved to your browser. You can also click the 'Save Progress' button in the sidebar. When you're done, you can download a PDF summary of your tax calculation.";
    }

    // Default response with suggestions
    return "I'm not sure about that specific question, but I can help you with topics like filing statuses, deductions, credits, tax brackets, Indiana state taxes, and Form 1040 line items. What would you like to know?";
}

function addUserMessage(message) {
    const messagesContainer = document.getElementById('emilyMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'user-message';
    messageDiv.innerHTML = `
        <div class="message-content">
            <strong>You</strong>
            <p>${message}</p>
        </div>
    `;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addEmilyMessage(message) {
    const messagesContainer = document.getElementById('emilyMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'emily-message';
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" fill="url(#emilyGradient3)"/>
                <circle cx="12" cy="10" r="3" fill="white"/>
                <path d="M6 20c0-3.5 2.5-6 6-6s6 2.5 6 6" fill="white"/>
                <defs>
                    <linearGradient id="emilyGradient3" x1="0" y1="0" x2="24" y2="24">
                        <stop offset="0%" stop-color="#8b5cf6"/>
                        <stop offset="100%" stop-color="#ec4899"/>
                    </linearGradient>
                </defs>
            </svg>
        </div>
        <div class="message-content">
            <strong>Emily</strong>
            <p>${message}</p>
        </div>
    `;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function speakResponse(text) {
    if (!emilySynthesis) return;

    // Cancel any ongoing speech
    emilySynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = emilyVoice;
    utterance.rate = 0.9;  // Slower for more natural pacing
    utterance.pitch = 1.0; // Normal pitch sounds more natural

    emilySynthesis.speak(utterance);
}

// Initialize Emily when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeEmily();
});
