Pod::Spec.new do |s|
  s.name = 'TravelLifeSignage'
  s.version = '1.0.0'
  s.summary = 'Local photo signage recognition for Travel Life'
  s.homepage = 'https://github.com/Stephenle2303/Travel-Life'
  s.license = { :type => 'Proprietary' }
  s.author = 'Travel Life'
  s.source = { :path => '.' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'ImageIO'
  s.source_files = '**/*.swift'
end
