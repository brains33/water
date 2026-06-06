import { supabase } from './supabase.js'

window.login = async function () {
  const phone = document.getElementById('phone').value.trim()
  const pin = document.getElementById('pin').value.trim()
  const errorMsg = document.getElementById('error-msg')

  if (!phone || pin.length !== 4) {
    errorMsg.textContent = 'Enter your phone and 4-digit PIN'
    return
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .eq('pin', pin)
    .single()

  if (error || !user) {
    errorMsg.textContent = 'Invalid phone or PIN'
    return
  }

  // Save session
  localStorage.setItem('pureflow_user', JSON.stringify(user))

  // Redirect based on role
  const routes = {
    admin: '/pages/admin/dashboard.html',
    vendor: '/pages/vendor/dashboard.html',
    driver: '/pages/driver/dashboard.html',
    cashier: '/pages/cashier/dashboard.html'
  }

  window.location.href = routes[user.role]
}