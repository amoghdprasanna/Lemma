---
id: siunitx-units
title: 'Numbers and units with siunitx'
status: style-choice
sources:
  - title: 'BIPM, The International System of Units (SI Brochure), 9th edition'
    url: https://www.bipm.org/en/publications/si-brochure
  - title: 'siunitx package documentation (CTAN)'
    url: https://ctan.org/pkg/siunitx
---

The SI Brochure sets two typographic rules for quantities: a **space between number and unit** ("5 GHz", not "5GHz"), and **upright unit symbols**, even inside formulas.

The `siunitx` package does both for you and keeps the style consistent:

```latex
\usepackage{siunitx}
... at \qty{10}{\milli\kelvin} with a \qty{20}{\nano\second} pulse at \qty{5}{\giga\hertz}
```

`\qty` is siunitx version 3; older installations use `\SI{10}{\milli\kelvin}`.

**Style choice.** Typing units by hand with `~` can also be correct. The package just makes consistency automatic.
