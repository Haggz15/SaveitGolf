Pod::Spec.new do |s|
  s.name           = 'VideoWatermark'
  s.version        = '1.0.0'
  s.summary        = 'Burns the SaveitGolf watermark into saved videos'
  s.description    = 'Burns the SaveitGolf watermark into saved videos'
  s.author         = ''
  s.homepage       = 'https://saveitgolf.com'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,swift}"
end
