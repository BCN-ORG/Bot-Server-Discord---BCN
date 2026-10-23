/**
 * Tinh rieng tong he so role va tong luong co dinh, sau do cong hai khoan.
 */
export function calculateMemberSalary(
  member,
  coefficientMap,
  fixedSalaryMap,
  hasCoefficientEligibility = true
) {
  let coefficientTotal = 0;
  let fixedSalaryTotal = 0;
  const roleDetails = [];
  const coefficientRoles = [];
  const fixedRoles = [];

  for (const [roleId, role] of member.roles.cache) {
    if (role.id === member.guild.id || role.managed) continue;

    const coefficient = hasCoefficientEligibility
      ? coefficientMap.get(roleId) ?? 1
      : 0;
    coefficientTotal += coefficient;
    const fixedAmount = fixedSalaryMap.get(roleId) ?? 0;
    const roleDetail = {
      roleId,
      roleName: role.name,
      coefficient,
      ...(fixedAmount > 0 ? { fixedAmount } : {})
    };
    if (hasCoefficientEligibility) {
      coefficientRoles.push({ roleId, roleName: role.name, coefficient });
    }
    roleDetails.push({
      ...roleDetail,
      payType: fixedAmount > 0
        ? (hasCoefficientEligibility ? 'coefficient+fixed' : 'fixed')
        : 'coefficient'
    });

    if (fixedAmount > 0) {
      fixedSalaryTotal += fixedAmount;
      fixedRoles.push({ roleId, roleName: role.name, amount: fixedAmount });
    }
  }

  const rawAmount = coefficientTotal + fixedSalaryTotal;
  const amount = Math.min(rawAmount, 100);
  const fixedSalaryIncluded = Math.max(
    0,
    amount - Math.min(coefficientTotal, 100)
  );

  return {
    amount,
    rawAmount,
    isCapped: rawAmount > 100,
    coefficientTotal,
    fixedSalaryTotal,
    fixedSalaryIncluded,
    roleDetails,
    coefficientRoles,
    fixedRoles
  };
}
