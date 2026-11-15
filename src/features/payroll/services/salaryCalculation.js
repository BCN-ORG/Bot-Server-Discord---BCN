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

    const fixedAmount = fixedSalaryMap.get(roleId) ?? 0;
    // Cách A: một role chỉ tạo một khoản trả. Nếu role có lương cố định,
    // role đó không đồng thời nhận khoản hệ số.
    const coefficient = hasCoefficientEligibility && fixedAmount <= 0
      ? coefficientMap.get(roleId) ?? 1
      : 0;
    coefficientTotal += coefficient;
    
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
      payType: fixedAmount > 0 ? 'fixed' : 'coefficient'
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

  // Tạo payment theo đúng thứ tự role của member: mỗi role chỉ một payment.
  for (const roleDetail of roleDetails) {
    const fixedAmount = roleDetail.fixedAmount ?? 0;
    const amount = fixedAmount > 0 ? fixedAmount : roleDetail.coefficient;
    if (amount <= 0) continue;

    const cappedAmount = Math.min(amount, 100);
    if (amount > 100) {
      console.warn(`[WARN] Payment capped for ${roleDetail.roleName} from ${amount} to 100 coins`);
      isCapped = true;
    }

    payments.push({
      type: fixedAmount > 0 ? 'fixed' : 'coefficient',
      roleId: roleDetail.roleId,
      roleName: roleDetail.roleName,
      amount: cappedAmount,
      description: ''
    });
    totalAmount += cappedAmount;
    rawTotalAmount += amount;
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
