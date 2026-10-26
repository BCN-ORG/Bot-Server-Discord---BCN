/**
 * Tinh luong thanh vien va tra ve mang cac payment rieng biet.
 * Moi payment se duoc goi API rieng biet de user nhan nhieu thong bao.
 */
export function calculateMemberSalary(
  member,
  coefficientMap,
  fixedSalaryMap,
  hasCoefficientEligibility = true
) {
  let coefficientTotal = 0;
  const roleDetails = [];
  const coefficientRoles = [];
  const fixedRoles = [];

  // Duyet qua tat ca roles de tinh he so va phat hien fixed salary
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
    
    if (hasCoefficientEligibility && coefficient > 0) {
      coefficientRoles.push({ roleId, roleName: role.name, coefficient });
    }
    
    roleDetails.push({
      ...roleDetail,
      payType: fixedAmount > 0
        ? (hasCoefficientEligibility ? 'coefficient+fixed' : 'fixed')
        : 'coefficient'
    });

    if (fixedAmount > 0) {
      fixedRoles.push({ roleId, roleName: role.name, amount: fixedAmount });
    }
  }

  // Tao mang payments
  const payments = [];
  let totalAmount = 0;
  let rawTotalAmount = 0;
  let isCapped = false;

  // 1. Payment cho he so (neu co coefficient eligibility)
  if (hasCoefficientEligibility && coefficientTotal > 0 && coefficientRoles.length > 0) {
    const coefficientAmount = Math.min(coefficientTotal, 100);
    if (coefficientTotal > 100) {
      console.warn(`[WARN] Payment capped: coefficient from ${coefficientTotal} to 100 coins`);
      isCapped = true;
    }
    
    // Chon role dau tien trong coefficientRoles lam roleId de tra
    const firstCoefficientRole = coefficientRoles[0];
    
    payments.push({
      type: 'coefficient',
      roleId: firstCoefficientRole.roleId,
      roleName: firstCoefficientRole.roleName,
      amount: coefficientAmount,
      description: '' // Se duoc set trong payrollService
    });
    
    totalAmount += coefficientAmount;
    rawTotalAmount += coefficientTotal;
  }

  // 2. Payments cho tung fixed salary role
  for (const fixedRole of fixedRoles) {
    const fixedAmount = Math.min(fixedRole.amount, 100);
    if (fixedRole.amount > 100) {
      console.warn(`[WARN] Payment capped: fixed for ${fixedRole.roleName} from ${fixedRole.amount} to 100 coins`);
      isCapped = true;
    }
    
    payments.push({
      type: 'fixed',
      roleId: fixedRole.roleId,
      roleName: fixedRole.roleName,
      amount: fixedAmount,
      description: '' // Se duoc set trong payrollService
    });
    
    totalAmount += fixedAmount;
    rawTotalAmount += fixedRole.amount;
  }

  return {
    payments,
    totalAmount,
    rawTotalAmount,
    isCapped,
    roleDetails,
    coefficientTotal,
    fixedSalaryTotal: fixedRoles.reduce((sum, r) => sum + r.amount, 0),
    coefficientRoles,
    fixedRoles
  };
}
