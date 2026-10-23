function calculateMaxHp(classes, constitutionModifier, bonus = 0) {
  const rolled = classes.reduce((hp, cls, index) => {
    const firstLevel = index === 0 ? cls.hitDie : Math.floor(cls.hitDie / 2) + 1;
    return hp + Math.max(1, firstLevel + constitutionModifier)
      + (cls.level - 1) * Math.max(1, Math.floor(cls.hitDie / 2) + 1 + constitutionModifier);
  }, 0);
  return Math.max(1, rolled + bonus);
}

function calculateMovementSpeed({ base, monkBonus = 0, barbarianBonus = 0, rovingBonus = 0, mobileBonus = 0, heavyArmorPenalty = 0 }) {
  return base + monkBonus + barbarianBonus + rovingBonus + mobileBonus - heavyArmorPenalty;
}
